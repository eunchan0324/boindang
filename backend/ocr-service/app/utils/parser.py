# app/utils/parser.py

import re

def clean_ingredient_text(text: str) -> str:
    # 불필요한 키워드 제거
    trash_keywords = [
        "포장재질", "품목", "업소명",
        "보고번호", "소재지", "고객상담실", "교환 및 반품", "부정.*?1399", "보관해 주십시오",
        "직사광선을.*?보관", "www\\..*", "http[s]?://.*", "전화[:：]?", "소비자 기본법.*",
        "구입한 곳", "식품의약품안전처",
        "상담실", "신고는 국번없이.*?", "080[-\\d]+", "서울\\)?\\d{3}[-]\\d{4}"
    ]
    for keyword in trash_keywords:
        text = re.sub(keyword, '', text, flags=re.IGNORECASE)

    # print(text)
    return text.strip()

def clean_nutrition_text(text: str) -> str:
    # 1. 소문자 변환 + 줄 단위 분리
    lines = text.lower().splitlines()

    # 2. 영양성분 키워드 정의
    nutrients = [
        "열량", "kcal", "나트륨", "탄수화물", "당류", "지방", "포화지방", "식이섬유",
        "트랜스지방", "콜레스테롤", "단백질", "칼로리", "단백", "트랜스", "포화"
    ]

    # 3. 키워드가 포함된 라인만 필터링
    relevant_lines = [
        line.strip() for line in lines
        if any(nutrient in line for nutrient in nutrients)
    ]

    # 4. 공백 정리 및 라인 이어붙이기
    joined = " ".join(re.sub(r'\s+', ' ', line) for line in relevant_lines)

    # 5. 숫자와 단위 붙이기 정리
    joined = re.sub(r'(\d+)\s*%', r'\1%', joined)
    joined = re.sub(r'(\d+)\s*g', r'\1g', joined)
    joined = re.sub(r'(\d+)\s*mg', r'\1mg', joined)

    # print(joined)
    return joined.strip()
