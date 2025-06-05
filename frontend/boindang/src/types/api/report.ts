// ReportPage Props 타입 정의
export type ReportPageProps = {
    params: Promise<{ productId: string }>;
  };
  
  // API 응답 내의 타입 정의
  export interface NutrientRatio {
    name: string;
    percent: number;
  }
  
  export interface NutrientDetail {
    name: string;
    value: number;
    percent: number;
    grade: string;
  }
  
  export interface IngredientItem {
    name: string;
    gi?: number; // Optional as not all ingredients have GI
    shortMessage?: string;
    description?: string[];
    riskLevel?: string;
  }
  
  export interface CategorizedIngredients {
    [category: string]: IngredientItem[];
  }
  
  export interface TopRisk {
    name: string;
    keyword: string;
    title: string;
    detail: string;
  }
  
  export interface ReportResultData {
    productName?: string;
    productImageUrl?: string; // 이미지 URL 필드 추가 (API 응답에 따라 확인 필요)
    ingredientImageUrl?: string;
    nutritionImageUrl?: string;
    nutritionSummary?: string;
    ingredientSummary?: string;
    totalWeight?: string; // API 응답에 없으므로, 필요시 추가 또는 고정값 사용
    kcal?: number;
    giGrade?: string;
    giIndex?: number;
    nutrientRatios?: NutrientRatio[];
    nutrientDetails?: NutrientDetail[];
    categorizedIngredients?: CategorizedIngredients;
    topRisks?: TopRisk[];
  }

  export interface ReportHistory {
    productId: string;
    productName: string;
    analyzedAt: string;
  }
  