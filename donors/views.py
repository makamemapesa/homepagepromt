from rest_framework import viewsets
from rest_framework.filters import SearchFilter
from django_filters.rest_framework import DjangoFilterBackend

from core.permissions import IsSuperAdminOrAdmin
from .models import Donor
from .serializers import DonorSerializer


class DonorViewSet(viewsets.ModelViewSet):
    """
    Donor management - Only Super Admins and Admins can manage donors.
    """
    queryset = Donor.objects.all()
    serializer_class = DonorSerializer
    permission_classes = [IsSuperAdminOrAdmin]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ["type", "status"]
    search_fields = ["name", "contact", "email"]
