package com.nutritionservice.nutrition.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import com.nutritionservice.common.exception.exception.BusinessException;
import com.nutritionservice.common.model.dto.ApiResponseStatus;
import com.nutritionservice.common.service.EurekaService;
import com.nutritionservice.nutrition.model.document.IngredientNode;
import com.nutritionservice.nutrition.model.document.NutritionReport;
import com.nutritionservice.nutrition.model.document.ProductNutrition;
import com.nutritionservice.nutrition.model.dto.analysis.NutrientResult;
import com.nutritionservice.nutrition.model.dto.external.EncyclopediaRequest;
import com.nutritionservice.nutrition.model.dto.external.EncyclopediaResponse;
import com.nutritionservice.nutrition.model.dto.external.IngredientDetail;
import com.nutritionservice.nutrition.model.dto.external.TopRisk;
import com.nutritionservice.nutrition.model.dto.external.UserInfo;
import com.nutritionservice.nutrition.model.dto.response.NutritionReportHistoryResponse;
import com.nutritionservice.nutrition.model.dto.response.NutritionReportResponse;
import com.nutritionservice.nutrition.repository.NutritionReportRepository;
import com.nutritionservice.nutrition.repository.ProductNutritionRepository;
import com.nutritionservice.nutrition.util.UserTypeConverter;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class NutritionService {

	private final ProductNutritionRepository productRepo;
	private final NutritionReportRepository reportRepo;

	private final RestClient restClient;
	private final EurekaService eurekaService;
	private final Logger logger = LoggerFactory.getLogger(NutritionService.class);
	private final UserService userService;

	public NutritionReportResponse analyzeProductForUser(String userId, String productId) {
		logger.debug("분석 api service 시작!!!!!!!!!!: " + userId + " | " + productId);
		// 0. 유저 조회
		logger.debug("유저 조회 시작 --------------------------------");
		UserInfo userInfo = getUserInfoOrThrow(userId);

		// ✅ 발표용
		if ("26".equals(userId)) {
			productId = "682d5a46e31db6072a55aa00"; // 예: 제로 초콜릿칩쿠키
		}

		// 1. 제품 조회
		logger.debug("제품 조회 시작 --------------------------------");
		ProductNutrition product = productRepo.findById(productId)
			.orElseThrow(() -> {
				throw new BusinessException(ApiResponseStatus.MONGODB_DATA_NOT_FOUND);
			});

		// 2. 영양성분 별 등급 계산
		logger.debug("영양성분 별 등급 계산 시작 --------------------------------");
		Map<String, NutrientResult> ratios = AnalysisHelper.calculateRatios(product, userInfo);

		// 3. 제품 성분 트리에서 원재료 리스트 조회
		logger.debug("제품 성분 트리에서 원재료 리스트 조회 시작 --------------------------------");
		List<String> ingredientNames = new ArrayList<>();
		for (IngredientNode node : product.getResult().getIngredientAnalysis().getIngredientTree()) {
			collectIngredientNames(node, ingredientNames);
		}

		// 4. 백과사전 API 호출
		logger.debug("백과사전 API 호출 시작 --------------------------------");
		String userType = UserTypeConverter.toEnglish(userInfo.getUserType());
		EncyclopediaResponse encyclopediaResponse = fetchEncyclopediaData(ingredientNames, userType, userId);

		// 데이터 필드 검증, (원재료 디테일 + 상위 위험 성분)
		logger.debug("데이터 필드 검증 시작 --------------------------------");

		List<IngredientDetail> allDetails = encyclopediaResponse.getData().getIngredients();
		List<TopRisk> topRisks = encyclopediaResponse.getData().getTopRisks();

		if (allDetails == null || allDetails.isEmpty()) {
			logger.debug("⚠️ 백과사전 성분 상세정보가 없습니다. → ingredientDetails=null");
			allDetails = new ArrayList<>();
		}
		if (topRisks == null || topRisks.isEmpty()) {
			logger.debug("⚠️ 우선순위 위험 성분 정보가 없습니다. → topRisks=null");
			topRisks = new ArrayList<>();
		}

		// 5. 원재료 용도별로 분리하여 매핑
		logger.debug("원재료 용도별로 분리하여 매핑 시작 --------------------------------");

		Map<String, List<IngredientDetail>> categorizedMap = categorizeIngredients(product, allDetails);

		// 6. NutritionReport 구성
		logger.debug("NutritionReport 구성 시작 --------------------------------");
		NutritionReport report = NutritionReport.from(
			userInfo.getId(),
			product,
			ratios,
			categorizedMap,
			topRisks
		);

		logger.debug("📄 [분석 리포트 생성 완료]");

		// 7. 몽고디비에 저장
		NutritionReport saved = saveOrUpdateReport(report);
		return NutritionReportResponse.from(saved);
	}

	private UserInfo getUserInfoOrThrow(String userId) {
		UserInfo userInfo = userService.getUserById(userId);
		logger.debug("👤 유저 정보 조회 - userInfo: {}", userInfo);
		return userInfo;
	}

	private EncyclopediaResponse fetchEncyclopediaData(List<String> ingredientNames, String userType, String userId) {
		EncyclopediaRequest req = new EncyclopediaRequest(ingredientNames, userType);
		EncyclopediaResponse response;
		try {
			String url = eurekaService.getUrl("ENCYCLOPEDIA") + "/user-type";
			logger.debug("🔗 백과사전 호출 URL: {}", url);
			response = restClient.post()
				.uri(url)
				.header("X-User-Id", userId)
				.body(req)
				.retrieve()
				.body(EncyclopediaResponse.class);
		} catch (Exception e) {
			throw new BusinessException(ApiResponseStatus.ENCYCLOPEDIA_CALL_FAILED);
		}

		if (response == null || response.getData() == null) {
			throw new BusinessException(ApiResponseStatus.ENCYCLOPEDIA_RESPONSE_NULL);
		}
		return response;
	}

	private Map<String, List<IngredientDetail>> categorizeIngredients(
		ProductNutrition product,
		List<IngredientDetail> allDetails
	) {
		Map<String, List<String>> categorized = product.getResult()
			.getIngredientAnalysis()
			.getCategorizedIngredients();

		Map<String, List<IngredientDetail>> result = new LinkedHashMap<>();
		List<String> order = List.of("감미료", "산도조절제", "유화제", "점질제", "착향료", "착색료", "보존제", "산화방지제", "팽창제", "기타");

		for (String category : order) {
			List<String> names = categorized.getOrDefault(category, List.of());
			List<IngredientDetail> matched = allDetails.stream()
				.filter(d -> names.contains(d.getName()))
				.toList();
			result.put(category, matched);
		}

		return result;
	}

	private void collectIngredientNames(IngredientNode node, List<String> result) {
		if (node.getName() != null) {
			result.add(node.getName());
		}
		if (node.getChildren() != null) {
			for (IngredientNode child : node.getChildren()) {
				collectIngredientNames(child, result);
			}
		}
	}

	private NutritionReport saveOrUpdateReport(NutritionReport report) {
		Optional<NutritionReport> existing = reportRepo.findByUserId(report.getUserId()).stream()
			.filter(r -> r.getProductId().equals(report.getProductId()))
			.findFirst();

		existing.ifPresent(e -> report.setId(e.getId()));
		NutritionReport saved = reportRepo.save(report);
		logger.debug("✅ 리포트 저장 완료 - ID: {}", saved.getId());
		return saved;
	}

	public List<NutritionReportHistoryResponse> getUserReportHistory(String userId) {
		return reportRepo.findByUserIdOrderByAnalyzedAtDesc(userId).stream()
			.map(NutritionReportHistoryResponse::from)
			.toList();
	}

	public NutritionReportResponse getFullReportByProductId(String userId, String productId) {
		NutritionReport report = reportRepo.findByUserIdAndProductId(userId, productId)
			.orElseThrow(() -> new BusinessException(ApiResponseStatus.REPORT_NOT_FOUND));
		return NutritionReportResponse.from(report);
	}

}
