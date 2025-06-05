package com.boindang.campaign.application;

import java.time.Duration;
import java.time.LocalDateTime;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.boindang.campaign.common.exception.BadRequestException;
import com.boindang.campaign.common.exception.CampaignNotFoundException;
import com.boindang.campaign.domain.model.Campaign;
import com.boindang.campaign.domain.model.CampaignApplication;
import com.boindang.campaign.domain.model.CampaignStatus;
import com.boindang.campaign.infrastructure.kafka.producer.KafkaCampaignProducer;
import com.boindang.campaign.infrastructure.redis.RedisApplicationStore;
import com.boindang.campaign.infrastructure.repository.CampaignApplicationRepository;
import com.boindang.campaign.infrastructure.repository.CampaignRepository;
import com.boindang.campaign.presentation.dto.response.ApplyEvent;
import com.boindang.campaign.presentation.dto.response.ApplyResultResponse;
import com.boindang.campaign.presentation.dto.response.TryApplyResult;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class CampaignApplyService {

	private final RedisApplicationStore redisStore;
	private final KafkaCampaignProducer kafkaProducer;
	private final CampaignRepository campaignRepository;
	private final CampaignApplicationRepository campaignApplicationRepository;

	public ApplyResultResponse apply(Long campaignId, Long userId) {
		log.debug("🔥 체험단 신청 시작: campaignId={}, userId={}", campaignId, userId);

		Campaign campaign = campaignRepository.findById(campaignId)
			.orElseThrow(() -> new CampaignNotFoundException("해당 체험단이 존재하지 않습니다."));

		// 모집 상태 확인
		if (campaign.getStatus() != CampaignStatus.OPEN) {
			throw new BadRequestException("진행중인 체험단만 신청할 수 있습니다.");
		}

		// TTL 계산
		Duration ttl = Duration.between(LocalDateTime.now(), campaign.getEndDate());
		log.debug("ttl: " + ttl);
		TryApplyResult result = redisStore.tryApply(campaignId, userId, campaign.getCapacity(), ttl);
		log.debug("currentCount: " + result.currentCount());

		// ✅ 모집 마감된 경우 (동시 신청에서 탈락자)
		if (result.isOverLimit()) {
			log.debug("[TTL]마감됨");
			return new ApplyResultResponse(campaignId, false, "정원이 마감되었습니다.");
		}

		// ✅ 마지막 인원이라면 상태를 닫음
		if (result.currentCount() == campaign.getCapacity()) {
			campaign.close();
			campaignRepository.save(campaign);
			log.debug("마지막 인원, status: " + campaign.getStatus());
		}

		// ✅ Kafka 발행
		log.debug("Kafka 발행 시작");
		kafkaProducer.send("apply-campaign", new ApplyEvent(campaignId, userId, true));

		// ✅ 선정된 사람
		return new ApplyResultResponse(campaignId, true, "체험단에 선정되었습니다.");
	}

	@Transactional
	public void applyBaselineDirect(Long campaignId, Long userId) {
		log.info("🔥 [Baseline] 체험단 신청 시작: campaignId={}, userId={}", campaignId, userId);

		Campaign campaign = campaignRepository.findById(campaignId)
			.orElseThrow(() -> new CampaignNotFoundException("해당 체험단이 존재하지 않습니다."));

		// 모집 상태 확인
		if (campaign.getStatus() != CampaignStatus.OPEN) {
			throw new BadRequestException("진행중인 체험단만 신청할 수 있습니다.");
		}

		boolean isSelected = campaign.getCurrentApplicants() < campaign.getCapacity();

		if (isSelected) {
			campaign.increaseApplicant(); // 카운트 증가
			campaign.calculateAndSyncStatus(LocalDateTime.now());
			campaignRepository.save(campaign);
		}

		// ✅ 선정 여부 관계없이 DB에 저장
		CampaignApplication application = CampaignApplication.of(
			new ApplyEvent(campaignId, userId, isSelected),
			campaign
		);
		campaignApplicationRepository.save(application);

		log.info("✅ [Baseline] 신청 저장 완료: 선정 여부 = {}", isSelected);
	}

}
