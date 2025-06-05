package com.boindang.campaign.infrastructure.redis;

import java.time.Duration;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import com.boindang.campaign.common.exception.CampaignException;
import com.boindang.campaign.presentation.dto.response.TryApplyResult;

import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class RedisApplicationStore {

	private final StringRedisTemplate redisTemplate;

	public TryApplyResult tryApply(Long campaignId, Long userId, long limit, Duration ttl) {
		String userKey = "apply:users:" + campaignId; // 중복 신청 방지용 Set
		String countKey = "apply:count:" + campaignId; // 신청 인원 카운트 Key

		// 1. ttl 유효성 체크 (체험단이 이미 마감된 경우 예외처리)
		if (ttl == null || ttl.isNegative() || ttl.isZero()) {
			throw new CampaignException("현재 신청할 수 없는 체험단입니다.");
		}

		// 2. 중복 신청 여부 확인
		Long added = redisTemplate.opsForSet().add(userKey, userId.toString());
		boolean isNewUser = (added != null && added == 1L);

		if (!isNewUser) {
			throw new CampaignException("이미 신청하신 체험단입니다.");
		}

		// 3. TTL 설정 (캠페인 마감 시점까지 캐시 유지)
		redisTemplate.expire(userKey, ttl);
		redisTemplate.expire(countKey, ttl);

		// 4. 현재 신청 수 증가 (atomic)
		Long currentCount = redisTemplate.opsForValue().increment(countKey);
		boolean isOverLimit = currentCount > limit;

		return new TryApplyResult(true, currentCount, isOverLimit);
	}

}
