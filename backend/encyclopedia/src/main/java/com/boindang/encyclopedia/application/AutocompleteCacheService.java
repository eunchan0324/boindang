package com.boindang.encyclopedia.application;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.data.redis.core.RedisTemplate;

import com.boindang.encyclopedia.domain.IngredientDictionary;
import com.boindang.encyclopedia.infrastructure.EncyclopediaRepository;
import com.boindang.encyclopedia.presentation.dto.response.EncyclopediaSearchResponse;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AutocompleteCacheService {

	private final RedisTemplate<String, String> redisTemplate;
	private final EncyclopediaRepository encyclopediaRepository;

	/**
	 * Redis에서 해당 초성(query)에 대한 자동완성 성분 목록을 조회
	 *
	 * - key 형식: "autocomplete::[초성]"
	 * - Redis에 캐싱된 성분 이름 목록을 기준으로 DB에서 상세 정보를 조회합니다.
	 * - Redis 순서를 보존하며, 존재하지 않는 성분은 필터링됩니다.
	 *
	 * @param query 초성 한 글자
	 * @return 캐시에 저장된 성분 이름들을 기반으로 조회된 응답 객체 리스트
	 */
	public List<EncyclopediaSearchResponse> getCachedAutocomplete(String query) {
		String redisKey = "autocomplete::" + query;

		// 캐시에서 최대 10개 가져오기 (캐시에는 이름만 존재)
		List<String> cachedNames = redisTemplate.opsForList().range(redisKey, 0, 9);
		if (cachedNames.isEmpty()) return Collections.emptyList();

		// name 리스트를 기준으로 DB에서 전체 정보 조회
		List<IngredientDictionary> ingredients = encyclopediaRepository.findByNameIn(cachedNames);

		// 조회된 성분을 map으로 변환해 순서 보존
		Map<String, IngredientDictionary> map = ingredients.stream()
			.collect(Collectors.toMap(IngredientDictionary::getName, Function.identity()));

		return cachedNames.stream()
			.map(map::get)
			.filter(Objects::nonNull)
			.map(EncyclopediaSearchResponse::from)
			.toList();
	}

}
