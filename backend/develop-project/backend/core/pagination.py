from rest_framework.pagination import PageNumberPagination


class StandardPagination(PageNumberPagination):
    """Page size the client can raise, e.g. `?page_size=200`.

    DRF only reads PAGE_SIZE from settings — PAGE_SIZE_QUERY_PARAM and
    MAX_PAGE_SIZE are class attributes, so setting them in REST_FRAMEWORK does
    nothing and every list stays capped at the default. Screens that legitimately
    need a whole class at once (marks entry, attendance registers, promotions)
    were silently getting the first 50 rows only.
    """
    page_size_query_param = "page_size"
    max_page_size = 500
