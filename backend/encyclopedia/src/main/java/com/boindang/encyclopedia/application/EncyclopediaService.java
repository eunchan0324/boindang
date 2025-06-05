package com.boindang.encyclopedia.application;

import com.boindang.encyclopedia.application.mapper.EncyclopediaMapper;
import com.boindang.encyclopedia.common.exception.ElasticSearchException;
import com.boindang.encyclopedia.common.exception.IngredientNotFoundException;
import com.boindang.encyclopedia.common.exception.InvalidIngredientQueryException;
import com.boindang.encyclopedia.domain.IngredientDictionary;
import com.boindang.encyclopedia.infrastructure.EncyclopediaRepository;
import com.boindang.encyclopedia.presentation.dto.response.EncyclopediaDetailResponse;
import com.boindang.encyclopedia.presentation.dto.response.EncyclopediaSearchResponse;
import com.boindang.encyclopedia.presentation.dto.response.IngredientListResponse;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.elasticsearch.common.unit.Fuzziness;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import org.elasticsearch.action.search.SearchRequest;
import org.elasticsearch.action.search.SearchResponse;
import org.elasticsearch.client.RequestOptions;
import org.elasticsearch.client.RestHighLevelClient;
import org.elasticsearch.index.query.BoolQueryBuilder;
import org.elasticsearch.index.query.QueryBuilders;
import org.elasticsearch.search.builder.SearchSourceBuilder;
import org.elasticsearch.search.sort.FieldSortBuilder;
import org.elasticsearch.search.sort.SortOrder;

import java.io.IOException;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class EncyclopediaService {

    private final RestHighLevelClient client;
    private final EncyclopediaRepository encyclopediaRepository;
    private final PopularIngredientService popularIngredientService;
    private RedisTemplate<String, String> redisTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    private static final Set<String> VALID_TYPES = Set.of("감미료", "식품첨가물", "단백질", "당류", "탄수화물", "식이섬유", "지방", "비타민", "미네랄");

    public EncyclopediaDetailResponse getIngredientDetail(String id) {
        return encyclopediaRepository.findById(id)
            .map(EncyclopediaMapper::toDetailResponse)
            .orElseThrow(() -> {
                log.warn("❗ 성분 조회 실패 - id={} : 해당 성분 없음", id);
                return new IngredientNotFoundException("해당 성분을 찾을 수 없습니다.");
            });
    }

    public IngredientListResponse getIngredientsByType(String category, String sort, String order, int size, int page) {
        if (!VALID_TYPES.contains(category)) {
            log.warn("❗ 잘못된 카테고리 요청 - category={}", category);
            throw new InvalidIngredientQueryException("존재하지 않는 카테고리입니다.");
        }

        // 1. 필터 조건
        BoolQueryBuilder boolQuery = QueryBuilders.boolQuery()
            .filter(QueryBuilders.termQuery("category", category));

        // 2. 정렬 조건
        SearchSourceBuilder sourceBuilder = new SearchSourceBuilder()
            .query(boolQuery)
            .from(page * size)  // ✅ 페이징 처리 시작 인덱스
            .size(size);        // ✅ 한 페이지 크기

        if (sort == null || sort.equals("name")) {
            // ✅ 기본 정렬: name.keyword 기준 오름차순 (가나다순)
            SortOrder sortOrder = "desc".equalsIgnoreCase(order) ? SortOrder.DESC : SortOrder.ASC;
            sourceBuilder.sort(new FieldSortBuilder("name.keyword").order(sortOrder));
        } else if (sort.equals("gi") || sort.equals("sweetness")) {
            SortOrder sortOrder = "asc".equalsIgnoreCase(order) ? SortOrder.ASC : SortOrder.DESC;
            sourceBuilder.sort(new FieldSortBuilder(sort).order(sortOrder));
        }

        // 3. Elasticsearch 요청 생성
        SearchRequest request = new SearchRequest("ingredients").source(sourceBuilder);

        try {
            SearchResponse response = client.search(request, RequestOptions.DEFAULT);

            long totalHits = response.getHits().getTotalHits().value;
            int totalPages = (int) Math.ceil((double) totalHits / size);

            List<EncyclopediaSearchResponse> ingredients = Arrays.stream(response.getHits().getHits())
                .map(hit -> EncyclopediaSearchResponse.from2(hit.getSourceAsMap()))
                .collect(Collectors.toList());

            return new IngredientListResponse(totalPages, ingredients);

        } catch (IOException e) {
            log.error("❌ Elasticsearch 성분 목록 조회 실패 - category={}, message={}", category, e.getMessage(), e);
            throw new ElasticSearchException("성분 목록을 불러오는 중 오류가 발생했습니다.");
        }
    }

    public EncyclopediaSearchResponse searchFuzzy(String query) {
        try {
            SearchSourceBuilder builder = new SearchSourceBuilder()
                .query(QueryBuilders.matchQuery("name", query)
                    .fuzziness(Fuzziness.TWO)
                    .prefixLength(0)
                    .maxExpansions(50)
                    .fuzzyTranspositions(true))
                .size(1);

            SearchRequest request = new SearchRequest("ingredients").source(builder);
            SearchResponse response = client.search(request, RequestOptions.DEFAULT);

            return Arrays.stream(response.getHits().getHits())
                .findFirst()
                .map(hit -> objectMapper.convertValue(hit.getSourceAsMap(), IngredientDictionary.class)) // ✅ 타입 변환
                .map(EncyclopediaSearchResponse::from) // ✅ DTO 변환
                .orElse(null);

        } catch (Exception e) {
            log.error("❌ Elasticsearch fuzzy 검색 실패: {}", e.getMessage(), e);
            return null;
        }
    }

}
