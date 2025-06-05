package com.boindang.campaign.presentation.dto.response;

public record TryApplyResult(
	boolean isNewUser,
	long currentCount,
	boolean isOverLimit
) {
	public boolean isSelected() {
		return !isOverLimit;
	}
}

