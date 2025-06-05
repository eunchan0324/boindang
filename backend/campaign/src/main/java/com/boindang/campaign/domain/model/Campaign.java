package com.boindang.campaign.domain.model;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import jakarta.persistence.Id;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

import com.boindang.campaign.common.exception.CampaignException;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Campaign {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;                  // 공고명
    @Column(columnDefinition = "TEXT")
    private String description;            // 공고 설명

    private String mainCategory;          // 제품 대분류
    private String subCategory;          // 제품 소분류

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "campaign_hashtags", joinColumns = @JoinColumn(name = "campaign_id"))
    @Column(name = "hashtag")
    private List<String> hashtags = new ArrayList<>();

    private int capacity;                  // 모집 인원
    private int currentApplicants = 0;     // 현재 신청 인원 수

    private String imageUrl;               // 제품 이미지

    @Enumerated(EnumType.STRING)
    private CampaignStatus status;         // 모집 상태 (예: OPEN)

    private LocalDateTime startDate;       // 오픈일
    private LocalDateTime endDate;         // 마감일

    @ElementCollection
    @CollectionTable(name = "campaign_notices", joinColumns = @JoinColumn(name = "campaign_id"))
    @Column(name = "notice")
    private List<String> notices = new ArrayList<>();  // 주의사항 리스트

    public Campaign(String name, String description, String mainCategory, String subCategory,
                    List<String> hashtags, int capacity, String imageUrl,
                    LocalDateTime startDate, LocalDateTime endDate, List<String> notices) {
        this.name = name;
        this.description = description;
        this.mainCategory = mainCategory;
        this.subCategory = subCategory;
        this.hashtags = hashtags;
        this.capacity = capacity;
        this.imageUrl = imageUrl;
        this.startDate = startDate;
        this.endDate = endDate;
        this.notices = notices;
        this.status = CampaignStatus.PENDING;
    }

    public boolean isAvailable() {
        LocalDateTime now = LocalDateTime.now(ZoneId.of("Asia/Seoul"));
        return calculateStatus(now) == CampaignStatus.OPEN;
    }

    @Transient
    public CampaignStatus calculateStatus(LocalDateTime now) {
        if (now.isBefore(this.startDate)) return CampaignStatus.PENDING;
        if (now.isAfter(this.endDate) || this.capacity == this.currentApplicants) return CampaignStatus.CLOSED;
        return CampaignStatus.OPEN;
    }

    public CampaignStatus calculateAndSyncStatus(LocalDateTime now) {
        CampaignStatus newStatus = calculateStatus(now);
        if (this.status != newStatus) {
            this.status = newStatus;
        }
        return newStatus;
    }

    public void increaseApplicant() {
        if (currentApplicants >= capacity) {
            throw new CampaignException("모집 정원이 마감되었습니다.");
        }
        this.currentApplicants++;
    }

    public void close() {
        if (this.status == CampaignStatus.CLOSED) {
            return; // 이미 종료된 상태라면 무시
        }
        this.status = CampaignStatus.CLOSED;
    }

}

