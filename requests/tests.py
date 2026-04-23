import os
import shutil
import json

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase, override_settings
from django.urls import reverse

from requests.models import Request, RequestDocument
from requests.services import suggest_request_category
from core.models import NotificationReceipt, Permission, RecordTimelineEntry, RoleDefinition, RolePermission, UserRole
from core.rbac_defaults import seed_rbac_defaults


User = get_user_model()


class RequestModelTests(TestCase):
    def test_request_generates_identifier_and_remaining_balance(self):
        request_obj = Request.objects.create(
            applicant_name='John Doe',
            applicant_email='john@example.com',
            applicant_phone='123456789',
            applicant_id='ID-001',
            address='Nairobi',
            category=Request.Category.TUITION,
            description='Need tuition support',
            amount_requested=1000,
            approved_amount=700,
            disbursed_amount=200,
        )

        self.assertTrue(request_obj.request_id.startswith('REQ-'))
        self.assertEqual(request_obj.remaining_balance, 500)

    def test_event_sponsorship_category_display_is_available(self):
        request_obj = Request.objects.create(
            applicant_name='Event Sponsor',
            applicant_email='event@example.com',
            applicant_phone='123456789',
            applicant_id='ID-002',
            address='Nairobi',
            category=Request.Category.EVENT_SPONSORSHIP,
            description='Need event sponsorship support',
            amount_requested=2000,
        )

        self.assertEqual(request_obj.category, Request.Category.EVENT_SPONSORSHIP)
        self.assertEqual(request_obj.get_category_display(), 'Event Sponsorship')

    def test_suggest_request_category_detects_event_sponsorship(self):
        suggested = suggest_request_category('Requesting sponsorship for a youth event and workshop')
        self.assertEqual(suggested, Request.Category.EVENT_SPONSORSHIP)


class RequestWorkflowTests(TestCase):
    def setUp(self):
        seed_rbac_defaults()
        self.media_root = os.path.join(os.getcwd(), 'test_media_requests')
        shutil.rmtree(self.media_root, ignore_errors=True)
        os.makedirs(self.media_root, exist_ok=True)
        self.addCleanup(lambda: shutil.rmtree(self.media_root, ignore_errors=True))

    def test_request_create_api_creates_record(self):
        user = User.objects.create_user(
            username='creator',
            email='creator@example.com',
            password='StrongPass1',
            role=User.Role.ADMIN,
            is_staff=True,
        )
        client = Client()
        client.force_login(user)

        response = client.post(
            reverse('request-list'),
            json.dumps({
                'applicant_name': 'Mary Example',
                'applicant_email': 'mary@example.com',
                'applicant_phone': '0712345678',
                'applicant_id': 'ID-100',
                'applicant_organization': 'Example School',
                'applicant_role': 'Teacher',
                'applicant_region': 'Nairobi',
                'address': 'Westlands',
                'title': 'Tuition Assistance',
                'category': Request.Category.TUITION,
                'description': 'Support for fees',
                'number_of_beneficiaries': 25,
                'amount_requested': '25000',
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Request.objects.count(), 1)
        request_obj = Request.objects.get()
        self.assertEqual(request_obj.applicant_organization, 'Example School')
        self.assertEqual(request_obj.number_of_beneficiaries, 25)

    def test_staff_cannot_create_request(self):
        staff = User.objects.create_user(
            username='staff-creator',
            email='staff-creator@example.com',
            password='StrongPass1',
            role=User.Role.STAFF,
            is_staff=False,
        )
        client = Client()
        client.force_login(staff)

        response = client.post(
            reverse('request-list'),
            json.dumps({
                'applicant_name': 'Blocked Staff',
                'applicant_email': 'blocked@example.com',
                'applicant_phone': '0712345678',
                'address': 'Nairobi',
                'category': Request.Category.OTHER,
                'description': 'Should be blocked',
                'amount_requested': '1000',
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 403)

    def test_director_can_approve_mark_paid_and_upload_document_via_api(self):
        with override_settings(MEDIA_ROOT=self.media_root):
            request_obj = Request.objects.create(
                applicant_name='Jane Doe',
                applicant_email='jane@example.com',
                applicant_phone='0711111111',
                applicant_id='ID-200',
                address='CBD',
                category=Request.Category.MEDICAL,
                description='Medical support',
                amount_requested=5000,
            )
            director = User.objects.create_user(
                username='director',
                password='StrongPass1',
                email='director@example.com',
                role=User.Role.DIRECTOR,
                is_staff=True,
            )
            finance = User.objects.create_user(
                username='finance',
                password='StrongPass1',
                email='finance@example.com',
                role=User.Role.FINANCE_OFFICER,
                is_staff=True,
            )

            api_client = Client()
            api_client.force_login(director)

            start_review_response = api_client.post(
                reverse('request-start-review', args=[request_obj.pk]),
                json.dumps({'comment': 'Moved for director review'}),
                content_type='application/json',
            )
            self.assertEqual(start_review_response.status_code, 200)

            approve_response = api_client.post(
                reverse('request-approve-request', args=[request_obj.pk]),
                json.dumps({'approved_amount': '3500', 'review_notes': 'Approved for urgent care'}),
                content_type='application/json',
            )
            self.assertEqual(approve_response.status_code, 200)

            request_obj.refresh_from_db()
            self.assertEqual(request_obj.status, Request.Status.APPROVED)
            self.assertEqual(float(request_obj.approved_amount), 3500.0)

            upload_response = api_client.post(
                reverse('request-upload-document', args=[request_obj.pk]),
                {
                    'document_type': 'Invoice',
                    'document': SimpleUploadedFile('invoice.pdf', b'%PDF-1.4 invoice', content_type='application/pdf'),
                },
            )
            self.assertEqual(upload_response.status_code, 201)
            request_obj.refresh_from_db()
            self.assertEqual(request_obj.documents.count(), 1)

            finance_client = Client()
            finance_client.force_login(finance)
            pay_response = finance_client.post(
                reverse('request-mark-as-paid', args=[request_obj.pk]),
                json.dumps({
                    'payment_date': '2026-03-09T10:00:00Z',
                    'payment_method': 'Bank Transfer',
                    'payment_reference': 'PAY-001',
                    'disbursed_amount': '4000',
                }),
                content_type='application/json',
            )
            self.assertEqual(pay_response.status_code, 200)

            request_obj.refresh_from_db()
            self.assertEqual(request_obj.status, Request.Status.PAID)
            self.assertEqual(float(request_obj.disbursed_amount), 4000.0)
            self.assertEqual(float(request_obj.remaining_balance), -500.0)
            self.assertEqual(RequestDocument.objects.count(), 1)

    def test_request_document_download_supports_inline_preview(self):
        with override_settings(MEDIA_ROOT=self.media_root):
            director = User.objects.create_user(
                username='director-inline-request',
                password='StrongPass1',
                email='director-inline-request@example.com',
                role=User.Role.DIRECTOR,
                is_staff=True,
            )
            request_obj = Request.objects.create(
                applicant_name='Preview User',
                applicant_email='preview@example.com',
                applicant_phone='0711111111',
                applicant_id='ID-201',
                address='CBD',
                category=Request.Category.MEDICAL,
                description='Medical support',
                amount_requested=5000,
                created_by=director,
            )
            document = RequestDocument.objects.create(
                request=request_obj,
                document=SimpleUploadedFile('invoice.pdf', b'%PDF-1.4 invoice', content_type='application/pdf'),
                document_type='Invoice',
                uploaded_by=director,
            )

            api_client = Client()
            api_client.force_login(director)
            response = api_client.get(
                reverse('document-download', args=[document.pk]),
                {'disposition': 'inline'},
            )

            self.assertEqual(response.status_code, 200)
            self.assertIn('inline;', response['Content-Disposition'])

    def test_admin_cannot_approve_even_with_request_approve_permission(self):
        request_obj = Request.objects.create(
            applicant_name='Case User',
            applicant_email='case@example.com',
            applicant_phone='0700000000',
            applicant_id='ID-300',
            address='Nairobi',
            category=Request.Category.OTHER,
            description='Testing approval restriction',
            amount_requested=1500,
        )
        admin = User.objects.create_user(
            username='admin-review',
            password='StrongPass1',
            email='admin-review@example.com',
            role=User.Role.ADMIN,
            is_staff=True,
        )

        # Deliberately grant request:approve to admin role to verify role guard still blocks.
        role_admin = RoleDefinition.objects.get(key=User.Role.ADMIN)
        perm_approve = Permission.objects.get(key='request:approve')
        RolePermission.objects.get_or_create(role=role_admin, permission=perm_approve)

        client = Client()
        client.force_login(admin)
        response = client.post(
            reverse('request-approve-request', args=[request_obj.pk]),
            json.dumps({'approved_amount': '1200', 'review_notes': 'Trying to approve'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 403)
        request_obj.refresh_from_db()
        self.assertEqual(request_obj.status, Request.Status.PENDING)

    def test_director_cannot_approve_submitted_without_under_review(self):
        request_obj = Request.objects.create(
            applicant_name='Submitted Case',
            applicant_email='submitted@example.com',
            applicant_phone='0700000005',
            applicant_id='ID-305',
            address='Nairobi',
            category=Request.Category.OTHER,
            description='Must move to under review first',
            amount_requested=1500,
            status=Request.Status.PENDING,
        )
        director = User.objects.create_user(
            username='director-submitted',
            password='StrongPass1',
            email='director-submitted@example.com',
            role=User.Role.DIRECTOR,
            is_staff=True,
        )
        client = Client()
        client.force_login(director)

        response = client.post(
            reverse('request-approve-request', args=[request_obj.pk]),
            json.dumps({'approved_amount': '1200', 'review_notes': 'Trying to approve submitted'}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 400)

    def test_staff_cannot_approve_or_reject_requests(self):
        request_obj = Request.objects.create(
            applicant_name='Staff Block Case',
            applicant_email='staff-block@example.com',
            applicant_phone='0700000001',
            applicant_id='ID-301',
            address='Nairobi',
            category=Request.Category.OTHER,
            description='Testing staff restriction',
            amount_requested=1800,
        )
        staff = User.objects.create_user(
            username='staff-review',
            password='StrongPass1',
            email='staff-review@example.com',
            role=User.Role.STAFF,
            is_staff=False,
        )

        client = Client()
        client.force_login(staff)

        approve_response = client.post(
            reverse('request-approve-request', args=[request_obj.pk]),
            json.dumps({'approved_amount': '1000', 'review_notes': 'Staff attempting approve'}),
            content_type='application/json',
        )
        reject_response = client.post(
            reverse('request-reject-request', args=[request_obj.pk]),
            json.dumps({'review_notes': 'Staff attempting reject'}),
            content_type='application/json',
        )

        self.assertEqual(approve_response.status_code, 403)
        self.assertEqual(reject_response.status_code, 403)
        request_obj.refresh_from_db()
        self.assertEqual(request_obj.status, Request.Status.PENDING)

    def test_primary_staff_cannot_approve_even_with_additional_director_role(self):
        request_obj = Request.objects.create(
            applicant_name='Primary Staff Block Case',
            applicant_email='primary-staff-block@example.com',
            applicant_phone='0700000003',
            applicant_id='ID-303',
            address='Nairobi',
            category=Request.Category.OTHER,
            description='Primary role enforcement',
            amount_requested=2000,
        )
        staff = User.objects.create_user(
            username='staff-plus-director',
            password='StrongPass1',
            email='staff-plus-director@example.com',
            role=User.Role.STAFF,
            is_staff=False,
        )
        director_role = RoleDefinition.objects.get(key=User.Role.DIRECTOR)
        UserRole.objects.create(user=staff, role=director_role)

        client = Client()
        client.force_login(staff)

        approve_response = client.post(
            reverse('request-approve-request', args=[request_obj.pk]),
            json.dumps({'approved_amount': '1500', 'review_notes': 'Should be blocked by primary role'}),
            content_type='application/json',
        )

        self.assertEqual(approve_response.status_code, 403)
        request_obj.refresh_from_db()
        self.assertEqual(request_obj.status, Request.Status.PENDING)

    def test_request_admin_actions_emit_in_app_notifications(self):
        owner = User.objects.create_user(
            username='request-owner',
            email='request-owner@example.com',
            password='StrongPass1',
            role=User.Role.STAFF,
            is_staff=False,
        )
        admin = User.objects.create_user(
            username='request-admin',
            email='request-admin@example.com',
            password='StrongPass1',
            role=User.Role.ADMIN,
            is_staff=True,
        )
        director = User.objects.create_user(
            username='request-director',
            email='request-director@example.com',
            password='StrongPass1',
            role=User.Role.DIRECTOR,
            is_staff=True,
        )
        request_obj = Request.objects.create(
            applicant_name='Notify Case',
            applicant_email='notify@example.com',
            applicant_phone='0700000002',
            applicant_id='ID-302',
            address='Nairobi',
            category=Request.Category.OTHER,
            description='Notification coverage',
            amount_requested=2200,
            created_by=owner,
        )

        admin_client = Client()
        admin_client.force_login(admin)
        cancel_response = admin_client.post(
            reverse('request-cancel', args=[request_obj.pk]),
            json.dumps({'comment': 'Cancelled for verification'}),
            content_type='application/json',
        )
        self.assertEqual(cancel_response.status_code, 200)

        restore_response = admin_client.post(
            reverse('request-restore', args=[request_obj.pk]),
            json.dumps({'comment': 'Restored for re-review'}),
            content_type='application/json',
        )
        self.assertEqual(restore_response.status_code, 200)

        director_client = Client()
        director_client.force_login(director)
        start_review_response = admin_client.post(
            reverse('request-start-review', args=[request_obj.pk]),
            json.dumps({'comment': 'Prepared for director decision'}),
            content_type='application/json',
        )
        self.assertEqual(start_review_response.status_code, 200)

        approve_response = director_client.post(
            reverse('request-approve-request', args=[request_obj.pk]),
            json.dumps({'approved_amount': '2000', 'review_notes': 'Approved for testing reverse'}),
            content_type='application/json',
        )
        self.assertEqual(approve_response.status_code, 200)

        reverse_response = admin_client.post(
            reverse('request-reverse', args=[request_obj.pk]),
            json.dumps({'comment': 'Reversed to under review'}),
            content_type='application/json',
        )
        self.assertEqual(reverse_response.status_code, 200)

        owner_titles = set(
            NotificationReceipt.objects.filter(user=owner)
            .select_related('notification')
            .values_list('notification__title', flat=True)
        )
        self.assertIn('Request cancelled', owner_titles)
        self.assertIn('Request restored', owner_titles)
        self.assertIn('Request approved', owner_titles)
        self.assertIn('Request reversed', owner_titles)

    def test_request_report_endpoint_returns_json_serializable_category_keys(self):
        admin = User.objects.create_user(
            username='report-admin',
            email='report-admin@example.com',
            password='StrongPass1',
            role=User.Role.ADMIN,
            is_staff=True,
        )
        Request.objects.create(
            applicant_name='Report Case',
            applicant_email='report@example.com',
            applicant_phone='0700000004',
            applicant_id='ID-304',
            address='Nairobi',
            category=Request.Category.TUITION,
            description='Report serialization coverage',
            amount_requested=3200,
            created_by=admin,
        )

        client = Client(HTTP_HOST='localhost')
        client.force_login(admin)
        response = client.get(reverse('request-report'))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn('category_stats', payload)
        self.assertIsInstance(payload['category_stats'], dict)
        self.assertIn('Tuition', payload['category_stats'])

    def test_partial_payment_then_completion_transitions(self):
        director = User.objects.create_user(
            username='payment-director',
            password='StrongPass1',
            email='payment-director@example.com',
            role=User.Role.DIRECTOR,
            is_staff=True,
        )
        finance = User.objects.create_user(
            username='payment-finance',
            password='StrongPass1',
            email='payment-finance@example.com',
            role=User.Role.FINANCE_OFFICER,
            is_staff=True,
        )
        request_obj = Request.objects.create(
            applicant_name='Payment Flow',
            applicant_email='payment-flow@example.com',
            applicant_phone='0700000099',
            applicant_id='ID-399',
            address='Dodoma',
            category=Request.Category.MEDICAL,
            description='Payment flow validation',
            amount_requested=10000,
        )

        director_client = Client()
        director_client.force_login(director)
        self.assertEqual(
            director_client.post(
                reverse('request-start-review', args=[request_obj.pk]),
                json.dumps({'comment': 'Ready for decision'}),
                content_type='application/json',
            ).status_code,
            200,
        )
        self.assertEqual(
            director_client.post(
                reverse('request-approve-request', args=[request_obj.pk]),
                json.dumps({'approved_amount': '8000', 'review_notes': 'Approved'}),
                content_type='application/json',
            ).status_code,
            200,
        )

        finance_client = Client()
        finance_client.force_login(finance)

        partial_payment_response = finance_client.post(
            reverse('request-mark-as-paid', args=[request_obj.pk]),
            json.dumps({
                'payment_method': 'Bank Transfer',
                'payment_reference': 'PART-100',
                'disbursed_amount': '3000',
            }),
            content_type='application/json',
        )
        self.assertEqual(partial_payment_response.status_code, 200)

        request_obj.refresh_from_db()
        self.assertEqual(request_obj.status, Request.Status.PARTIALLY_PAID)

        add_payment_response = finance_client.post(
            reverse('request-add-payment', args=[request_obj.pk]),
            json.dumps({
                'payment_method': 'Bank Transfer',
                'payment_reference': 'PART-200',
                'payment_amount': '5000',
            }),
            content_type='application/json',
        )
        self.assertEqual(add_payment_response.status_code, 200)

        request_obj.refresh_from_db()
        self.assertEqual(request_obj.status, Request.Status.PAID)

    def test_director_can_revert_own_decision(self):
        director = User.objects.create_user(
            username='director-revert-own',
            password='StrongPass1',
            email='director-revert-own@example.com',
            role=User.Role.DIRECTOR,
            is_staff=True,
        )
        request_obj = Request.objects.create(
            applicant_name='Revert Own',
            applicant_email='revert-own@example.com',
            applicant_phone='0700000101',
            applicant_id='ID-401',
            address='Arusha',
            category=Request.Category.OTHER,
            description='Director should revert own decision',
            amount_requested=3000,
            status=Request.Status.UNDER_REVIEW,
        )

        client = Client()
        client.force_login(director)

        self.assertEqual(
            client.post(
                reverse('request-approve-request', args=[request_obj.pk]),
                json.dumps({'approved_amount': '2500', 'review_notes': 'Approved by same director'}),
                content_type='application/json',
            ).status_code,
            200,
        )
        self.assertEqual(
            client.post(
                reverse('request-reverse', args=[request_obj.pk]),
                json.dumps({'comment': 'Reverting own decision'}),
                content_type='application/json',
            ).status_code,
            200,
        )

        request_obj.refresh_from_db()
        self.assertEqual(request_obj.status, Request.Status.UNDER_REVIEW)

    def test_director_cannot_revert_other_director_decision(self):
        director_one = User.objects.create_user(
            username='director-one',
            password='StrongPass1',
            email='director-one@example.com',
            role=User.Role.DIRECTOR,
            is_staff=True,
        )
        director_two = User.objects.create_user(
            username='director-two',
            password='StrongPass1',
            email='director-two@example.com',
            role=User.Role.DIRECTOR,
            is_staff=True,
        )
        request_obj = Request.objects.create(
            applicant_name='Revert Other',
            applicant_email='revert-other@example.com',
            applicant_phone='0700000102',
            applicant_id='ID-402',
            address='Mwanza',
            category=Request.Category.OTHER,
            description='Other director revert should fail',
            amount_requested=4500,
            status=Request.Status.UNDER_REVIEW,
        )

        client_one = Client()
        client_one.force_login(director_one)
        self.assertEqual(
            client_one.post(
                reverse('request-approve-request', args=[request_obj.pk]),
                json.dumps({'approved_amount': '3200', 'review_notes': 'Approved by director one'}),
                content_type='application/json',
            ).status_code,
            200,
        )

        client_two = Client()
        client_two.force_login(director_two)
        response = client_two.post(
            reverse('request-reverse', args=[request_obj.pk]),
            json.dumps({'comment': 'Director two attempting revert'}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 403)

    def test_request_detail_includes_timeline_entries_and_hides_internal_notes_from_staff(self):
        director = User.objects.create_user(
            username='timeline-director',
            password='StrongPass1',
            email='timeline-director@example.com',
            role=User.Role.DIRECTOR,
            is_staff=True,
        )
        staff_owner = User.objects.create_user(
            username='timeline-staff-owner',
            password='StrongPass1',
            email='timeline-staff-owner@example.com',
            role=User.Role.STAFF,
            is_staff=False,
        )
        request_obj = Request.objects.create(
            applicant_name='Timeline Request',
            applicant_email='timeline-request@example.com',
            applicant_phone='0700000103',
            applicant_id='ID-403',
            address='Morogoro',
            category=Request.Category.OTHER,
            description='Timeline coverage',
            amount_requested=5000,
            status=Request.Status.UNDER_REVIEW,
            created_by=staff_owner,
        )

        director_client = Client()
        director_client.force_login(director)

        approve_response = director_client.post(
            reverse('request-approve-request', args=[request_obj.pk]),
            json.dumps({'approved_amount': '4200', 'review_notes': 'Approved with adjustment'}),
            content_type='application/json',
        )
        self.assertEqual(approve_response.status_code, 200)

        note_response = director_client.post(
            reverse('request-timeline-entries', args=[request_obj.pk]),
            json.dumps({'mode': 'internal_note', 'body': 'Director-only internal note'}),
            content_type='application/json',
        )
        self.assertEqual(note_response.status_code, 201)
        self.assertTrue(
            RecordTimelineEntry.objects.filter(
                request=request_obj,
                entry_type=RecordTimelineEntry.EntryType.INTERNAL_NOTE,
                is_internal=True,
            ).exists()
        )

        detail_response = director_client.get(reverse('request-detail', args=[request_obj.pk]))
        self.assertEqual(detail_response.status_code, 200)
        director_entries = detail_response.json().get('timeline_entries', [])
        self.assertTrue(any(entry['entry_type'] == 'approval_action' for entry in director_entries))
        self.assertTrue(any(entry['entry_type'] == 'internal_note' for entry in director_entries))

        staff_client = Client()
        staff_client.force_login(staff_owner)
        staff_detail_response = staff_client.get(reverse('request-detail', args=[request_obj.pk]))
        self.assertEqual(staff_detail_response.status_code, 200)
        staff_entries = staff_detail_response.json().get('timeline_entries', [])
        self.assertTrue(any(entry['entry_type'] == 'approval_action' for entry in staff_entries))
        self.assertFalse(any(entry['entry_type'] == 'internal_note' for entry in staff_entries))
