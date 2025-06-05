package com.nutritionservice.nutrition.model.dto.response;

import com.nutritionservice.nutrition.model.document.NutritionReport;
import com.nutritionservice.nutrition.model.dto.analysis.NutrientResult;
import com.nutritionservice.nutrition.model.dto.external.IngredientDetail;
import com.nutritionservice.nutrition.model.dto.external.TopRisk;
import lombok.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NutritionReportResponse {

    private String productName; // 제품 이름
    private String nutritionImageUrl;
    private String ingredientImageUrl;
    private String nutritionSummary;
    private String ingredientSummary;


    private int kcal;           // 총 열량

    private int giIndex;    // 통합 GI
    private String giGrade;     // 안전 / 주의 / 위험

    private List<NutrientRatio> nutrientRatios;   // 탄단지 비율
    private List<NutrientDetail> nutrientDetails; // 각 성분 등급

    @Setter
    private Map<String, List<IngredientDetail>> categorizedIngredients; // ✅ 카테고리별 원재료 상세 리스트
    private List<TopRisk> topRisks;               // 위험 리스트


    public static NutritionReportResponse from(NutritionReport report) {
        return NutritionReportResponse.builder()
                .productName(report.getProductName())
                .nutritionImageUrl(report.getNutritionImageUrl())
                .ingredientImageUrl(report.getIngredientImageUrl())
                .nutritionSummary(report.getNutritionSummary())
                .ingredientSummary(report.getIngredientSummary())
                .kcal(report.getKcal())
                .giIndex(report.getGiIndex())
                .giGrade(report.getGiGrade())
                .nutrientRatios(toRatios(report.getRatios()))
                .nutrientDetails(toDetails(report.getRatios()))
                .categorizedIngredients(report.getCategorizedIngredients())
                .topRisks(report.getTopRisks())
                .build();
    }

    private static List<NutrientRatio> toRatios(Map<String, ?> ratios) {
        if (ratios == null) return List.of();

        double carb = getSafeValue(ratios, "탄수화물");
        double protein = getSafeValue(ratios, "단백질");
        double fat = getSafeValue(ratios, "지방");

        double total = carb + protein + fat;
        if (total == 0.0) return List.of();

        return List.of("탄수화물", "단백질", "지방").stream()
                .map(name -> new NutrientRatio(name,
                        Math.round(getSafeValue(ratios, name) / total * 1000.0) / 10.0))
                .toList();
    }

    private static double getSafeValue(Map<String, ?> ratios, String key) {
        Object obj = ratios.get(key);
        if (obj instanceof NutrientResult r) {
            return r.getValue(); // ✅ value 기준 비율 계산
        }
        return 0.0;
    }

    private static List<NutrientDetail> toDetails(Map<String, ?> ratios) {
        if (ratios == null) return List.of();
        List<NutrientDetail> result = new ArrayList<>();
        for (Map.Entry<String, ?> entry : ratios.entrySet()) {
            if (entry.getValue() instanceof NutrientResult r) {
                result.add(new NutrientDetail(entry.getKey(), r.getValue(), r.getPercent(), r.getGrade()));
            }
        }
        return result;
    }

    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class NutrientRatio {
        private String name;     // ex: "탄수화물"
        private double percent;  // ex: 40.0
    }

    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class NutrientDetail {
        private String name;     // ex: "지방"
        private double value;    // ex: 14g
        private double percent;  // 권장 대비 %
        private String grade;    // 양호/주의/위험
    }
}
