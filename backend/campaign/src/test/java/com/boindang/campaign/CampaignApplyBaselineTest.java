package com.boindang.campaign;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import com.boindang.campaign.application.CampaignApplyService;
import com.boindang.campaign.infrastructure.repository.CampaignApplicationRepository;

@ActiveProfiles("test")
@SpringBootTest
@DisplayName("Baseline: 체험단 신청 대량 처리 테스트")
class CampaignApplyBaselineTest {

	@Autowired
	private CampaignApplyService applyService;

	@Autowired
	private CampaignApplicationRepository applicationRepository; // 신청 저장소 (DB)

	private final Long campaignId = 1L;

	@Test
	@DisplayName("1000명 동시 체험단 신청 시 DB 직저장 성능 측정")
	void testCampaignApplyBaseline() throws InterruptedException {
		int numberOfUsers = 1000;
		CountDownLatch latch = new CountDownLatch(numberOfUsers);
		ExecutorService executorService = Executors.newFixedThreadPool(50);

		long startTime = System.currentTimeMillis();

		for (long i = 1; i <= numberOfUsers; i++) {
			final long userId = i;
			executorService.submit(() -> {
				try {
					applyService.applyBaselineDirect(campaignId, userId); // 🔁 이건 Kafka/Redis 없는 전용 메서드여야 안전함
				} catch (Exception e) {
					System.out.println("❌ 실패: userId=" + userId + ", error=" + e.getMessage());
				} finally {
					latch.countDown();
				}
			});
		}

		latch.await(); // 모든 요청 완료 대기
		long endTime = System.currentTimeMillis();

		System.out.println("✅ 전체 처리 시간: " + (endTime - startTime) + "ms");

		long dbAppliedCount = applicationRepository.countByCampaign_Id(campaignId);
		System.out.println("📊 DB 저장 수 (직접 저장 방식): " + dbAppliedCount);
	}
}

