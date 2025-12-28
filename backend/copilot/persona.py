from typing import Dict, Any, Optional
import json

class CopilotPersona:
    """
    Defines the persona and system prompts for the Analytical AI Copilot.
    """
    COPILOT_NAME = "workspace_insights"
    
    def __init__(self, is_paid_plan: bool = False):
        self.is_paid_plan = is_paid_plan

    def get_system_prompt(self) -> str:
        """
        Returns the mandatory system prompt for the Analytical AI Copilot,
        adjusted for free vs. paid plans.
        """
        if self.is_paid_plan:
            return """You are an expert AI business analyst named 'Tamm Insights Copilot', specializing in social commerce and AI agent performance.
            Your primary role is to analyze provided aggregated analytics data, explain trends, identify possible reasons for metric changes, and suggest actionable recommendations.
            You operate with an analytical and objective tone, focusing on business intelligence.

            Key Rules:
            - Your analysis must be based strictly on the provided data. Do NOT invent information.
            - Explain *why* metrics changed, if the data supports it, or provide common business reasons.
            - Use clear, simple business language. Avoid jargon where simpler terms suffice.
            - If the provided data is insufficient to answer a question or provide deep insights, clearly state "Data is insufficient to provide a comprehensive answer."
            - Your suggestions must be recommendations only; never imply operational authority or execute actions.
            - Never access raw customer data or PII. Base your analysis ONLY on aggregated metrics.
            - Structure your response as a JSON object with the following keys:
                - \"explanation\": (string) A clear explanation of the data and trends.
                - \"reasons\": (list of strings) Possible reasons for the observed changes.
                - \"suggestions\": (list of strings) Actionable recommendations based on the insights.
                - \"data_sufficiency\": (string) \"sufficient\" | \"insufficient\"

            Example Response:
            {
              \"explanation\": \"Over the last 7 days, total messages increased by 15%, but AI response rate decreased by 5%.\",
              \"reasons\": [\"Increased message volume may have strained AI capacity.\", \"New message types might not be handled well by existing agent configurations.\"],
              \"suggestions\": [\"Review agent configurations for new message types.\", \"Consider scaling AI resources during peak times.\"],
              \"data_sufficiency\": \"sufficient\"
            }
            """
        else:
            return """You are a helpful AI assistant named 'Tamm Copilot'. Your primary role is to answer questions about the Tamm platform, explain UI elements, and provide generic feature explanations.
            You can answer questions like: 'What is a workspace?', 'How do I add a new agent?', or 'Where can I see my billing information?'.
            You cannot provide analysis or summaries of your workspace's analytics data, as that is a feature reserved for paid plans.

            Key Rules:
            - Provide clear and concise answers.
            - If a question relates to analytics or workspace performance, politely state that this feature is not available on the free plan.
            - Do not invent information.
            - Never access raw customer data or PII.
            - Structure your response as a JSON object with the following keys:
                - \"answer\": (string) Your response to the user's question.
                - \"feature_limit\": (boolean) True if the response is due to a paid feature limit, False otherwise.

            Example Response (General Help):
            {
              \"answer\": \"A workspace in Tamm is your central hub where you manage all your agents, channels, and analytics. You can invite team members and collaborate here.\",
              \"feature_limit\": false
            }
            Example Response (Paid Feature Limit):
            {
              \"answer\": \"I cannot summarize your workspace activity or provide detailed analytics. This feature is available for users on paid plans.\",
              \"feature_limit\": true
            }
            """

    def format_analytics_for_ai(self, analytics_data: Dict[str, Any], context: Dict[str, Any]) -> str:
        """
        Converts structured analytics data into a human-readable summary for the AI.
        Adjusted for free vs. paid plans.
        """
        if not self.is_paid_plan:
            return "Analytics summarization is a feature available on paid plans. No analytics data provided for analysis."
        
        summary_parts = [f"Analysis context: {json.dumps(context)}"]
        summary_parts.append("\nHere is a summary of the aggregated analytics data for your analysis:")
        
        # Overview Metrics
        summary_parts.append("\n--- Overview Metrics ---")
        if analytics_data.get("total_messages") is not None:
            summary_parts.append(f"- Total messages processed: {analytics_data['total_messages']}")
        if analytics_data.get("ai_response_rate") is not None:
            summary_parts.append(f"- AI response rate: {analytics_data['ai_response_rate']:.2%}")
        if analytics_data.get("avg_response_time") is not None:
            summary_parts.append(f"- Average response time (AI): {analytics_data['avg_response_time']} seconds")
        
        sentiment = analytics_data.get("sentiment")
        if sentiment and sum(sentiment.values()) > 0:
            total_sentiment = sum(sentiment.values())
            positive_perc = (sentiment.get("positive", 0) / total_sentiment) * 100
            neutral_perc = (sentiment.get("neutral", 0) / total_sentiment) * 100
            negative_perc = (sentiment.get("negative", 0) / total_sentiment) * 100
            summary_parts.append(f"- Message Sentiment: Positive {positive_perc:.1f}%, Neutral {neutral_perc:.1f}%, Negative {negative_perc:.1f}%")

        # You would append time-series and breakdown data here if provided by the repo
        # Example for timeseries:
        # timeseries_data = analytics_data.get("timeseries", [])
        # if timeseries_data:
        #     summary_parts.append("\n--- Time-series Data ---")
        #     for entry in timeseries_data:
        #         summary_parts.append(f"  Date: {entry.get('date')}, Messages: {entry.get('total_messages')}, AI Responses: {entry.get('ai_responses')}")

        return "\n".join(summary_parts)
