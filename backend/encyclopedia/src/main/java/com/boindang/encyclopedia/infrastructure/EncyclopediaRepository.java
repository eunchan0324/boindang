package com.boindang.encyclopedia.infrastructure;

import com.boindang.encyclopedia.domain.IngredientDictionary;
import org.springframework.data.elasticsearch.repository.ElasticsearchRepository;
import org.springframework.stereotype.Repository;
import org.springframework.data.elasticsearch.annotations.Query;

import java.util.List;

@Repository
public interface EncyclopediaRepository extends ElasticsearchRepository<IngredientDictionary, String> {
    List<IngredientDictionary> findByNameContaining(String query);

    @Query("{ \"terms\": { \"name.keyword\": ?0 } }")
    List<IngredientDictionary> findByNameIn(List<String> names);
    List<IngredientDictionary> findByIdIn(List<String> ids);
    List<IngredientDictionary> findByName(String name);
}
