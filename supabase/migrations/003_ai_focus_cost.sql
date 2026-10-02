-- 003_ai_focus_cost.sql
-- Adds a price for the "What should I focus on?" command now that all AI
-- commands run on Hugging Face through the `ai` Edge Function.

CREATE OR REPLACE FUNCTION public.ai_operation_cost(p_operation TEXT)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_operation
    WHEN 'generate_cards' THEN 5
    WHEN 'break_down_task' THEN 3
    WHEN 'board_analysis' THEN 8
    WHEN 'sprint_summary' THEN 3
    WHEN 'workflow_optimization' THEN 10
    WHEN 'dependency_analysis' THEN 8
    WHEN 'what_if_analysis' THEN 6
    WHEN 'focus_recommendation' THEN 5
  END;
$$;
