"""Fee questions other apps need answered.

Kept here rather than in the caller so the rule that decides whether a student
is square with the bursar lives next to the payments it reads.
"""
from decimal import Decimal

from .models import Payment


def term_fee_clearance(student_ids, term):
    """Is each student clear to receive term-end paperwork for ``term``?

    Returns ``{student_id: (cleared, reason)}`` covering every id passed in.
    ``reason`` is the empty string when cleared, and otherwise phrased for a
    member of staff reading a list of who was skipped.

    A student is clear when at least one payment for the term is confirmed and
    none is still awaiting confirmation — the same rule the Report Cards screen
    already applies to Print and Download, so the button and the page agree.
    Failed payments are neither credit nor a blocker; they simply do not count.
    """
    student_ids = list(student_ids)
    totals = {sid: {"confirmed": Decimal("0"), "pending": Decimal("0")} for sid in student_ids}

    payments = Payment.objects.filter(
        student_id__in=student_ids, term=term, status__in=["confirmed", "pending"]
    ).values_list("student_id", "status", "amount")
    for student_id, status, amount in payments:
        totals[student_id][status] += amount

    clearance = {}
    for student_id in student_ids:
        confirmed = totals[student_id]["confirmed"]
        pending = totals[student_id]["pending"]
        if confirmed > 0 and pending == 0:
            clearance[student_id] = (True, "")
        elif pending > 0:
            clearance[student_id] = (
                False,
                f"TSh {pending:,.0f} of the fee payment for {term} is still awaiting confirmation.",
            )
        else:
            clearance[student_id] = (
                False,
                f"No confirmed fee payment recorded for {term}.",
            )
    return clearance
