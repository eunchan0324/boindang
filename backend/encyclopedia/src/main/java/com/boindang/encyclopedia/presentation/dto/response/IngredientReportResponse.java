package com.boindang.encyclopedia.presentation.dto.response;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
@AllArgsConstructor
public class IngredientReportResponse {
	private String name;
	private String newName;
	private int gi;
	private String shortMessage;
	private String keyword;
	private List<String> description;
	private String riskLevel;
}
