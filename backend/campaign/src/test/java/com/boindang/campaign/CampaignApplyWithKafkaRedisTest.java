package com.boindang.campaign;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import com.boindang.campaign.application.CampaignApplyService;
import com.boindang.campaign.infrastructure.repository.CampaignApplicationRepository;

@ActiveProfiles("test")
@SpringBootTest
@DisplayName("Redis + Kafka: 체험단 신청 대량 처리 테스트")
@TestPropertySource(properties = {
	"spring.kafka.bootstrap-servers=localhost:9092"
})
class CampaignApplyWithKafkaRedisTest {

	@Autowired
	private CampaignApplyService applyService;

	@Autowired
	private RedisTemplate<String, String> redisTemplate;

	@Autowired
	private CampaignApplicationRepository applicationRepository;

	private final Long campaignId = 1L;

	@Test
	@DisplayName("1000명 동시 체험단 신청 (Redis 중복 필터 + Kafka 비동기 저장)")
	void testApplyWithKafkaAndRedis() throws InterruptedException {
		int numberOfUsers = 1000;
		CountDownLatch latch = new CountDownLatch(numberOfUsers);
		ExecutorService executor = Executors.newFixedThreadPool(50);

		long start = System.currentTimeMillis();

		for (long i = 1; i <= numberOfUsers; i++) {
			final long userId = i;
			executor.submit(() -> {
				try {
					applyService.apply(campaignId, userId); // Redis + Kafka 사용
				} catch (Exception e) {
					System.out.println("❌ 실패: userId=" + userId + ", error=" + e.getMessage());
				} finally {
					latch.countDown();
				}
			});
		}

		latch.await();
		long end = System.currentTimeMillis();

		System.out.println("✅ 전체 처리 시간: " + (end - start) + "ms");

		// Redis key (Set 기반 신청 저장)
		String redisKey = "apply:users:" + campaignId;
		Long redisCount = redisTemplate.opsForSet().size(redisKey);
		System.out.println("📊 Redis 저장 수: " + redisCount);

		// Kafka Consumer가 DB에 저장한 수 (약간 지연될 수 있음)
		Thread.sleep(3000); // Kafka Consumer가 소비 완료할 시간 확보
		long dbAppliedCount = applicationRepository.countByCampaign_Id(campaignId);
		System.out.println("📊 DB 저장 수 (Kafka 처리 결과): " + dbAppliedCount);
	}
}


