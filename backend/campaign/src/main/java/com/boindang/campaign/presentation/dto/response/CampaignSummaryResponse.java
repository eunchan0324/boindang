package com.boindang.campaign.presentation.dto.response;

import java.time.LocalDateTime;
import java.util.List;

import com.boindang.campaign.domain.model.Campaign;
import com.boindang.campaign.domain.model.CampaignStatus;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;


@Getter
@Builder
@AllArgsConstructor
public class CampaignSummaryResponse {
	private Long id;
	private String name;
	private String content;
	private String imageUrl;
	private LocalDateTime startDate;
	private LocalDateTime deadline;
	private String status; // 모집 예정, 진행중, 종료
	private int capacity;
	private int currentApplicants;
	private List<String> hashtags;
	private boolean isApplied;

	public static CampaignSummaryResponse from(Campaign campaign, boolean isApplied) {
		return CampaignSummaryResponse.builder()
			.id(campaign.getId())
			.name(campaign.getName())
			.content(campaign.getDescription())
			.imageUrl(campaign.getImageUrl())
			.startDate(campaign.getStartDate())
			.deadline(campaign.getEndDate())
			.status(convertStatusToLabel(campaign.getStatus()))
			.capacity(campaign.getCapacity())
			.currentApplicants(campaign.getCurrentApplicants())
			.hashtags(campaign.getHashtags())
			.isApplied(isApplied)
			.build();
	}

	private static String convertStatusToLabel(CampaignStatus status) {
		return switch (status) {
			case PENDING -> "모집 예정";
			case OPEN -> "진행중";
			case CLOSED -> "종료";
		};
	}
}
