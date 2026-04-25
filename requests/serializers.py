from rest_framework import serializers
from django.urls import reverse
from core.timeline import get_request_timeline_entries, serialize_timeline_entries
from .models import Request, RequestDocument, RequestHistory


class RequestDocumentSerializer(serializers.ModelSerializer):
    """Serializer for RequestDocument model"""
    
    uploaded_by_name = serializers.CharField(source='uploaded_by.get_full_name', read_only=True)
    filename = serializers.SerializerMethodField()
    download_url = serializers.SerializerMethodField()

    def get_filename(self, obj: RequestDocument) -> str:
        try:
            return (obj.document.name or '').split('/')[-1]
        except Exception:
            return ''

    def get_download_url(self, obj: RequestDocument) -> str:
        request = self.context.get("request")
        url = reverse("document-download", kwargs={"pk": obj.pk})
        return request.build_absolute_uri(url) if request else url
    
    class Meta:
        model = RequestDocument
        fields = (
            'id',
            'document',
            'filename',
            'download_url',
            'document_type',
            'uploaded_by',
            'uploaded_by_name',
            'uploaded_at',
        )
        read_only_fields = ('id', 'uploaded_at', 'uploaded_by')


class RequestHistorySerializer(serializers.ModelSerializer):
    performed_by_name = serializers.CharField(source='performed_by.get_full_name', read_only=True)

    class Meta:
        model = RequestHistory
        fields = (
            'id',
            'action',
            'from_status',
            'to_status',
            'comment',
            'performed_by',
            'performed_by_name',
            'created_at',
        )
        read_only_fields = fields


class RequestSerializer(serializers.ModelSerializer):
    """Serializer for Request model"""
    
    documents = RequestDocumentSerializer(many=True, read_only=True)
    history = RequestHistorySerializer(many=True, read_only=True)
    timeline_entries = serializers.SerializerMethodField()
    reviewed_by_name = serializers.CharField(source='reviewed_by.get_full_name', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    finance_processed_by_name = serializers.CharField(source='finance_processed_by.get_full_name', read_only=True)

    def get_timeline_entries(self, obj: Request):
        view = self.context.get("view")
        if getattr(view, "action", None) != "retrieve":
            return []
        request = self.context.get("request")
        viewer = getattr(request, "user", None)
        return serialize_timeline_entries(get_request_timeline_entries(obj, viewer))
    
    class Meta:
        model = Request
        fields = ('id', 'request_id', 'applicant_name', 'applicant_email', 'applicant_phone',
                 'applicant_id', 'applicant_organization', 'applicant_role', 'applicant_region',
                 'address', 'title', 'category', 'category_display', 'description',
                 'number_of_beneficiaries',
                 'amount_requested', 'approved_amount', 'disbursed_amount', 'remaining_balance',
                 'status', 'status_display', 'workflow_route',
                 'reviewed_by', 'reviewed_by_name', 'review_notes',
                 'reviewed_at', 'payment_date', 'payment_method', 'payment_reference',
                 'finance_processed_by', 'finance_processed_by_name',
                 'finance_notes', 'finance_processed_at',
                 'created_by', 'created_by_name',
                 'documents', 'history', 'timeline_entries', 'created_at', 'updated_at')
        read_only_fields = ('id', 'request_id', 'remaining_balance', 'workflow_route',
                           'created_at', 'updated_at',
                           'reviewed_by', 'reviewed_at', 'reviewed_by_name',
                           'finance_processed_by', 'finance_processed_by_name', 'finance_processed_at',
                           'created_by', 'created_by_name')


class RequestCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating Request"""
    status = serializers.ChoiceField(
        choices=[Request.Status.DRAFT, Request.Status.PENDING],
        required=False,
        default=Request.Status.PENDING,
    )

    class Meta:
        model = Request
        fields = (
            'applicant_name', 'applicant_email', 'applicant_phone', 'applicant_id',
            'applicant_organization', 'applicant_role', 'applicant_region',
            'address', 'title', 'category', 'description', 'number_of_beneficiaries',
            'amount_requested', 'status'
        )
        
    def validate_amount_requested(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount requested must be greater than 0")
        return value

    def validate(self, attrs):
        if self.instance is not None and 'status' in attrs:
            raise serializers.ValidationError("Status updates must use workflow actions.")
        return super().validate(attrs)


class RequestApprovalSerializer(serializers.ModelSerializer):
    """Serializer for approving/rejecting requests"""
    
    class Meta:
        model = Request
        fields = ('status', 'approved_amount', 'review_notes')
        
    def validate(self, data):
        approved_amount = data.get('approved_amount', serializers.empty)
        if approved_amount is serializers.empty:
            approved_amount = getattr(self.instance, 'approved_amount', None)
        if approved_amount is None:
            raise serializers.ValidationError("Approved amount is required for approval")
        return data


class RequestReportSerializer(serializers.ModelSerializer):
    """Serializer for request reports"""
    
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = Request
        fields = ('request_id', 'applicant_name', 'category', 'category_display', 
                 'amount_requested', 'approved_amount', 'disbursed_amount', 'remaining_balance',
                 'status', 'status_display', 'payment_date', 'created_at')
