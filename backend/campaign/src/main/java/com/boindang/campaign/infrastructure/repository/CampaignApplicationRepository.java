package com.boindang.campaign.infrastructure.repository;

import java.util.List;

import com.boindang.campaign.domain.model.CampaignApplication;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CampaignApplicationRepository extends JpaRepository<CampaignApplication, Long> {
    boolean existsByCampaignIdAndUserId(Long campaignId, Long userId);
    @Query("SELECT ca FROM CampaignApplication ca JOIN FETCH ca.campaign WHERE ca.userId = :userId")
    List<CampaignApplication> findWithCampaignByUserId(@Param("userId") Long userId);
    long countByCampaign_Id(Long campaignId);

}
