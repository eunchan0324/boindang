package com.boindang.encyclopedia.application;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.elasticsearch.action.search.SearchRequest;
import org.elasticsearch.action.search.SearchResponse;
import org.elasticsearch.client.RequestOptions;
import org.elasticsearch.client.RestHighLevelClient;
import org.elasticsearch.common.unit.Fuzziness;
import org.elasticsearch.index.query.QueryBuilders;
import org.elasticsearch.search.SearchHit;
import org.elasticsearch.search.builder.SearchSourceBuilder;
import org.springframework.stereotype.Service;

import com.boindang.encyclopedia.domain.IngredientDictionary;
import com.boindang.encyclopedia.domain.ReportDocument;
import com.boindang.encyclopedia.infrastructure.EncyclopediaRepository;
import com.boindang.encyclopedia.infrastructure.ReportElasticsearchRepository;
import com.boindang.encyclopedia.presentation.dto.response.IngredientReportResponse;
import com.boindang.encyclopedia.presentation.dto.response.RiskIngredientSummary;
import com.boindang.encyclopedia.presentation.dto.response.UserReportResponse;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ReportService {

	private final ReportElasticsearchRepository reportRepository;
	private final EncyclopediaRepository ingredientRepository;
	private final RestHighLevelClient client;

	public UserReportResponse getUserReport(List<String> ingredientNames, String userType) {
		Map<String, String> resolvedMap = resolveActualNames(ingredientNames);
		List<String> resolvedNames = new ArrayList<>(resolvedMap.values());

		List<ReportDocument> reports = reportRepository.findByNameIn(resolvedNames);
		List<IngredientDictionary> ingredients = ingredientRepository.findByNameIn(resolvedNames);

		Map<String, IngredientDictionary> ingredientMap = ingredients.stream()
			.collect(Collectors.toMap(
				i -> normalize(i.getName()),  // name 정규화
				i -> i
			));

		Map<String, ReportDocument> reportMap = reports.stream()
			.collect(Collectors.toMap(ReportDocument::getName, r -> r, (a, b) -> a));

		List<IngredientReportResponse> ingredientResponses = new ArrayList<>();
		List<RiskIngredientData> riskyList = new ArrayList<>();

		for (Map.Entry<String, String> entry : resolvedMap.entrySet()) {
			String original = entry.getKey();     // 사용자가 입력한 값
			String resolved = entry.getValue().trim();   // 실제 검색된 성분
			System.out.println("사용자가 입력한 성분: " + original);
			System.out.println("실제 검색된 성분: " + resolved);

			IngredientDictionary ingredient = ingredientMap.get(normalize(resolved));
			ReportDocument report = reportMap.get(resolved);

			String riskLevel = report != null
				? getRiskLevelByUserType(
				report.getRiskLevel(),
				userType,
				(ingredient != null && ingredient.getRiskLevel() != null)
					? ingredient.getRiskLevel().getLabel()
					: "정보 없음"
			)
				: (ingredient != null && ingredient.getRiskLevel() != null)
				? ingredient.getRiskLevel().getLabel()
				: "정보 없음";

			int score = report != null ? getScoreByUserType(report, userType) : 0;
			List<String> userMessage = report != null ? getMessageByUserType(report, userType) : List.of("정보 없음", "해당 성분에 대한 설명이 없습니다.");

			ingredientResponses.add(IngredientReportResponse.builder()
				.name(original) // ✅ 추가됨
				.newName(resolved)
				.gi(ingredient != null ? ingredient.getGi() : 0)
				.shortMessage(report != null ? report.getShortMessage() : "설명이 없습니다.")
				.keyword(report != null ? report.getKeyword() : "정보 없음")
				.description(Collections.singletonList(ingredient != null ? ingredient.getDescription() : "설명이 없습니다."))
				.riskLevel(riskLevel)
				.build());

			System.out.println("🔥 [ING] " + ingredient);
			System.out.println("🔥 [ING DESC] " + (ingredient != null ? ingredient.getDescription() : "null"));
			System.out.println("🔥 [ING GI] " + (ingredient != null ? ingredient.getGi() : "null"));

			if ("주의".equals(riskLevel) || "높음".equals(riskLevel)) {
				riskyList.add(new RiskIngredientData(score, userMessage));
			}
		}

		List<RiskIngredientSummary> topRisks = reports.stream()
			.filter(doc -> {
				IngredientDictionary ingredient = ingredientMap.get(doc.getName());
				String fallbackRisk = (ingredient != null && ingredient.getRiskLevel() != null)
					? ingredient.getRiskLevel().getLabel()
					: "정보 없음";
				String risk = getRiskLevelByUserType(doc.getRiskLevel(), userType, fallbackRisk);
				return "주의".equals(risk) || "높음".equals(risk);
			})
			.sorted(Comparator.comparingInt(doc -> getScoreByUserType((ReportDocument)doc, userType)).reversed())  // ✅ 정렬 여기서
			.map(doc -> {
				List<String> msg = getMessageByUserType(doc, userType);
				return RiskIngredientSummary.builder()
					.name(doc.getName())
					.keyword(msg.get(0))
					.title(msg.get(1))
					.detail(msg.get(2))
					.build();
			})
			.limit(3)
			.toList();

		return UserReportResponse.builder()
			.ingredients(ingredientResponses)
			.topRisks(topRisks)
			.build();
	}

	private String normalize(String input) {
		return input == null ? "" : input.trim().replaceAll("\\s+", "");
	}

	private String getRiskLevelByUserType(ReportDocument.RiskLevel reportRisk, String userType, String ingredientRiskLevel) {
		return switch (userType.toLowerCase()) {
			case "diabetic" -> reportRisk.getDiabetic();
			case "kidneypatient" -> reportRisk.getKidneyPatient();
			case "dieter" -> reportRisk.getDieter();
			case "musclebuilder" -> reportRisk.getMuscleBuilder();
			default -> ingredientRiskLevel != null ? ingredientRiskLevel : "정보 없음";
		};
	}

	private int getScoreByUserType(ReportDocument doc, String userType) {
		return switch (userType.toLowerCase()) {
			case "diabetic" -> doc.getDiabeticScore();
			case "kidneypatient" -> doc.getKidneyPatientScore();
			case "dieter" -> doc.getDieterScore();
			case "musclebuilder" -> doc.getMuscleBuilderScore();
			default -> 0;
		};
	}

	private List<String> getMessageByUserType(ReportDocument doc, String userType) {
		return switch (userType.toLowerCase()) {
			case "diabetic" -> doc.getDiabetic();
			case "kidneypatient" -> doc.getKidneyPatient();
			case "dieter" -> doc.getDieter();
			case "musclebuilder" -> doc.getMuscleBuilder();
			default -> List.of("정보 없음", "유저타입 정보가 없습니다.");
		};
	}

	private record RiskIngredientData(int score, List<String> message) {}

	public Map<String, String> resolveActualNames(List<String> queries) {
		Map<String, String> resolvedMap = new LinkedHashMap<>(); // 순서 유지

		for (String query : queries) {
			String bestMatch = null;
			float topScore = -1f;

			SearchRequest request = new SearchRequest("reports");
			SearchSourceBuilder builder = new SearchSourceBuilder()
				.query(QueryBuilders.boolQuery()
					.should(QueryBuilders.matchQuery("name", query).fuzziness(Fuzziness.AUTO).boost(2.0f))
					.should(QueryBuilders.prefixQuery("name", query).boost(1.0f))
				)
				.size(5);

			request.source(builder);

			try {
				SearchResponse response = client.search(request, RequestOptions.DEFAULT);
				for (SearchHit hit : response.getHits()) {
					Map<String, Object> src = hit.getSourceAsMap();
					if (src.get("name") != null && hit.getScore() > topScore) {
						bestMatch = src.get("name").toString();
						topScore = hit.getScore();
					}
				}
			} catch (Exception e) {
				// log
			}

			resolvedMap.put(query, bestMatch != null ? bestMatch : query);
		}

		return resolvedMap;
	}

}
