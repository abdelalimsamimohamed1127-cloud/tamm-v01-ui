import datetime
import uuid
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework import exceptions

from core.auth import SupabaseJWTAuthentication
from core.permissions import IsWorkspaceMember
from analytics.serializers import AnalyticsQuerySerializer, InsightsQuestionSerializer, StructuredInsightRequestSerializer # Import new serializer
from analytics.supabase_repo import AnalyticsSupabaseRepo
from analytics.insights import InsightsEngine # Ensure this is the correct InsightsEngine class

import logging
from core.errors import SupabaseUnavailableError, AIAProviderError

logger = logging.getLogger(__name__)

class AnalyticsOverviewAPIView(APIView):
    """
    API endpoint for retrieving a summary of analytics metrics.
    GET /api/v1/analytics/overview
    """
    authentication_classes = [SupabaseJWTAuthentication]
    permission_classes = [IsWorkspaceMember]

    def get(self, request, *args, **kwargs):
        serializer = AnalyticsQuerySerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)

        workspace_id = request.workspace_id
        user_jwt = request.auth

        logger.info(
            "Fetching analytics overview",
            extra={
                "workspace_id": workspace_id,
                "start_date": serializer.validated_data['start_date'],
                "end_date": serializer.validated_data['end_date'],
                "agent_id": serializer.validated_data.get('agent_id'),
                "channel": serializer.validated_data.get('channel'),
            },
        )
        try:
            repo = AnalyticsSupabaseRepo(user_jwt)
            
            overview_data = repo.get_overview_metrics(
                workspace_id=workspace_id,
                start_date=serializer.validated_data['start_date'],
                end_date=serializer.validated_data['end_date'],
                agent_id=serializer.validated_data.get('agent_id'),
                channel=serializer.validated_data.get('channel')
            )
            return Response(overview_data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(
                "Error fetching analytics overview",
                extra={"workspace_id": workspace_id, "error": str(e)},
                exc_info=True,
            )
            raise SupabaseUnavailableError(detail=f"Could not fetch analytics overview: {e}")


class AnalyticsTimeseriesAPIView(APIView):
    """
    API endpoint for retrieving time-series analytics data.
    GET /api/v1/analytics/timeseries
    """
    authentication_classes = [SupabaseJWTAuthentication]
    permission_classes = [IsWorkspaceMember]

    def get(self, request, *args, **kwargs):
        serializer = AnalyticsQuerySerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)

        workspace_id = request.workspace_id
        user_jwt = request.auth

        logger.info(
            "Fetching analytics timeseries",
            extra={
                "workspace_id": workspace_id,
                "start_date": serializer.validated_data['start_date'],
                "end_date": serializer.validated_data['end_date'],
                "agent_id": serializer.validated_data.get('agent_id'),
                "channel": serializer.validated_data.get('channel'),
            },
        )
        try:
            repo = AnalyticsSupabaseRepo(user_jwt)
            
            timeseries_data = repo.get_timeseries_data(
                workspace_id=workspace_id,
                start_date=serializer.validated_data['start_date'],
                end_date=serializer.validated_data['end_date'],
                agent_id=serializer.validated_data.get('agent_id'),
                channel=serializer.validated_data.get('channel')
            )
            return Response(timeseries_data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(
                "Error fetching analytics timeseries",
                extra={"workspace_id": workspace_id, "error": str(e)},
                exc_info=True,
            )
            raise SupabaseUnavailableError(detail=f"Could not fetch analytics timeseries: {e}")


class AnalyticsBreakdownAPIView(APIView):
    """
    API endpoint for retrieving analytics data broken down by a specific dimension.
    GET /api/v1/analytics/breakdown?breakdown_by=agent
    """
    authentication_classes = [SupabaseJWTAuthentication]
    permission_classes = [IsWorkspaceMember]

    def get(self, request, *args, **kwargs):
        serializer = AnalyticsQuerySerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)

        breakdown_by = request.query_params.get('breakdown_by')
        if not breakdown_by:
            raise exceptions.ValidationError("Query parameter 'breakdown_by' is required (e.g., 'agent', 'channel', 'topic').")

        workspace_id = request.workspace_id
        user_jwt = request.auth

        logger.info(
            "Fetching analytics breakdown",
            extra={
                "workspace_id": workspace_id,
                "breakdown_by": breakdown_by,
                "start_date": serializer.validated_data['start_date'],
                "end_date": serializer.validated_data['end_date'],
            },
        )

        try:
            repo = AnalyticsSupabaseRepo(user_jwt)
            
            breakdown_data = repo.get_breakdown_data(
                workspace_id=workspace_id,
                start_date=serializer.validated_data['start_date'],
                end_date=serializer.validated_data['end_date'],
                breakdown_by=breakdown_by,
                agent_id=serializer.validated_data.get('agent_id'),
                channel=serializer.validated_data.get('channel')
            )
            return Response(breakdown_data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(
                "Error fetching analytics breakdown",
                extra={"workspace_id": workspace_id, "breakdown_by": breakdown_by, "error": str(e)},
                exc_info=True,
            )
            raise SupabaseUnavailableError(detail=f"Could not fetch analytics breakdown: {e}")


class InsightsAPIView(APIView):
    """
    API endpoint for generating AI-powered insights from analytics data,
    or for triggering structured insight generation.
    POST /api/v1/analytics/insights
    """
    authentication_classes = [SupabaseJWTAuthentication]
    permission_classes = [IsWorkspaceMember]
    # TODO: Add throttling for this endpoint as it hits AI models

    def get(self, request, *args, **kwargs):
        serializer = AnalyticsQuerySerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)

        workspace_id = request.workspace_id
        user_jwt = request.auth

        start_date = serializer.validated_data.get('start_date')
        end_date = serializer.validated_data.get('end_date')
        insight_type = serializer.validated_data.get('insight_type')

        logger.info(
            "Fetching insights",
            extra={
                "workspace_id": workspace_id,
                "start_date": start_date,
                "end_date": end_date,
                "insight_type": insight_type,
            },
        )
        try:
            repo = AnalyticsSupabaseRepo(user_jwt)
            insights = repo.get_insights(
                workspace_id=workspace_id,
                start_date=start_date,
                end_date=end_date,
                insight_type=insight_type
            )
            return Response(insights, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(
                "Error fetching insights",
                extra={"workspace_id": workspace_id, "error": str(e)},
                exc_info=True,
            )
            raise SupabaseUnavailableError(detail=f"Could not fetch insights: {e}")

    def post(self, request, *args, **kwargs):
        workspace_id = request.workspace_id
        user_jwt = request.auth

        # Check if this is a request for structured insight generation
        if "period_start" in request.data and "period_end" in request.data:
            structured_serializer = StructuredInsightRequestSerializer(data=request.data)
            structured_serializer.is_valid(raise_exception=True)

            period_start = structured_serializer.validated_data['period_start']
            period_end = structured_serializer.validated_data['period_end']

            logger.info(
                "Triggering structured insight generation",
                extra={
                    "workspace_id": workspace_id,
                    "period_start": period_start,
                    "period_end": period_end,
                },
            )

            try:
                insights_engine = InsightsEngine(workspace_id=workspace_id, user_jwt=user_jwt) # Instantiate my InsightsEngine
                insights_engine.generate_structured_insights(
                    period_start=period_start,
                    period_end=period_end
                )
                return Response({"status": "Insight generation triggered."}, status=status.HTTP_202_ACCEPTED)
            except Exception as e:
                logger.error(
                    "Error triggering structured insight generation",
                    extra={"workspace_id": workspace_id, "error": str(e)},
                    exc_info=True,
                )
                raise exceptions.APIException(detail=f"An unexpected error occurred while triggering insight generation: {e}")

        # Fallback to AI-powered insight generation (existing logic)
        ai_serializer = InsightsQuestionSerializer(data=request.data)
        ai_serializer.is_valid(raise_exception=True)

        question = ai_serializer.validated_data['question']
        context = ai_serializer.validated_data.get('context', {})
        
        logger.info(
            "Generating AI insight",
            extra={
                "workspace_id": workspace_id,
                "question": question,
                "context": context,
            },
        )

        try:
            # Date and UUID validation logic... (as per existing code)
            if 'range' in context:
                if context['range'] == '7d':
                    context['start_date'] = datetime.date.today() - datetime.timedelta(days=7)
                    context['end_date'] = datetime.date.today()
            
            start_date = context.get('start_date')
            end_date = context.get('end_date')

            if isinstance(start_date, str):
                context['start_date'] = datetime.date.fromisoformat(start_date)
            if isinstance(end_date, str):
                context['end_date'] = datetime.date.fromisoformat(end_date)
            
            agent_id = context.get('agent_id')
            if agent_id and not isinstance(agent_id, uuid.UUID):
                context['agent_id'] = uuid.UUID(agent_id)

            insights_engine = InsightsEngine(workspace_id=workspace_id, user_jwt=user_jwt) # The existing AI-powered InsightsEngine
            
            insight_response = insights_engine.generate_insight(
                question=question,
                context=context,
                agent_id=context.get('agent_id')
            )
            
            return Response(insight_response, status=status.HTTP_200_OK)
        except (exceptions.ValidationError, exceptions.ParseError) as e:
            raise e # Let DRF handle validation errors
        except Exception as e:
            logger.error(
                "Error generating AI insight",
                extra={"workspace_id": workspace_id, "question": question, "error": str(e)},
                exc_info=True,
            )
            # This could be an AIAProviderError or a generic one
            if "AI provider" in str(e):
                 raise AIAProviderError(detail=f"Could not generate insight: {e}")
            raise exceptions.APIException(detail=f"An unexpected error occurred while generating the insight: {e}")