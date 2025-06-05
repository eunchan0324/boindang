package com.boindang.campaign.infrastructure.kafka.consumer;

import java.util.concurrent.atomic.AtomicInteger;

import org.springframework.kafka.KafkaException;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import com.boindang.campaign.application.CampaignSaveService;
import com.boindang.campaign.presentation.dto.response.ApplyEvent;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
@RequiredArgsConstructor
public class KafkaConsumer {

	private final CampaignSaveService saveService;
	private final ObjectMapper objectMapper;

	public static AtomicInteger consumedCount = new AtomicInteger();

	@KafkaListener(topics = "apply-campaign", groupId = "campaign-group")
	public void consume(String message) {
		log.info("📥 Kafka 메시지 수신됨: {}", message);
		consumedCount.incrementAndGet();

		try {
			ApplyEvent event = objectMapper.readValue(message, ApplyEvent.class);
			log.info("✅ 메시지 역직렬화 완료: {}", event);

			saveService.save(event);
			log.info("✅ Campaign 신청 저장 성공: campaignId={}, userId={}", event.getCampaignId(), event.getUserId());

		} catch (Exception e) {
			log.error("❗Kafka 소비 중 예외 발생", e);
			throw new KafkaException("Kafka 소비 중 예외가 발생하였습니다.");
		}
	}
}

