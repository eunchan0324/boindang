# app/services/main_service.py

import asyncio
from app.services.ocr_service import call_clova_ocr_with_url
from app.services.gpt_service import ask_gpt_ingredient, ask_gpt_nutrition
from app.db.mongo_repository import save_product
from app.utils.parser import clean_ingredient_text


# 🧠 OCR → GPT 하나의 흐름을 처리하는 함수
async def ocr_and_gpt(image_url: str, mode: str):
    # OCR 처리
    text = await call_clova_ocr_with_url(image_url)
    print(f"[{mode.upper()} OCR 결과]:", text)

    # GPT 분석
    if mode == "ingredient":
        text = clean_ingredient_text(text)
        result = await ask_gpt_ingredient(text)
    elif mode == "nutrition":
        result = await ask_gpt_nutrition(text)
    else:
        raise ValueError("Invalid mode: must be 'ingredient' or 'nutrition'")

    return result


# 🧪 병렬 처리 메인 서비스
async def process_images(image_urls: dict, ingredient_url: str, nutrition_url: str):
    print("🚀 [비동기 OCR → GPT 병렬 실행 시작]")

    # 두 흐름을 병렬로 실행
    result_ingredient, result_nutrition = await asyncio.gather(
        ocr_and_gpt(ingredient_url, "ingredient"),
        ocr_and_gpt(nutrition_url, "nutrition")
    )

    print("🎯 [GPT 분석 완료]")

    result = {
        "ingredientAnalysis": result_ingredient,
        "nutritionAnalysis": result_nutrition
    }

    # 제품명 추출
    product_name = result_ingredient.get("basicInfo", {}).get("name", "Unknown Product")

    # MongoDB 저장
    inserted_id = save_product(image_urls, product_name, result)

    response = {
        "productId": inserted_id,
        "productName": product_name,
        "result": result,
    }

    # print(f"✅ 제품 분석 완료 - 제품명: {product_name}, ID: {inserted_id}")
    print(f"✅ 제품 분석 완료")
    return response
