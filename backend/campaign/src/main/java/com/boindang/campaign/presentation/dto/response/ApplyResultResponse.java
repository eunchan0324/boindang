package com.boindang.campaign.presentation.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class ApplyResultResponse {
	private Long campaignId;
	private boolean isSelected;
	private String message;
}
