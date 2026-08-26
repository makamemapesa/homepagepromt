"""
Default content for every editable block on the public home page.

These mirror what the page used to hard-code, so a fresh install looks exactly
as before and each value only changes once an administrator edits it.

Each default is its own callable because Django migrations must be able to
serialise the reference.
"""


def hero_stats():
    return [
        {"value": "3", "label": "Education Levels"},
        {"value": "100%", "label": "Accredited"},
        {"value": "ZEC", "label": "Aligned"},
        {"value": "NECTA", "label": "Exam Board"},
    ]


def credentials():
    return [
        {"label": "Reg. No.", "value": "P 10082026"},
        {"label": "ZRB Number", "value": "Z052610299"},
        {"label": "TIN", "value": "175-002-324"},
        {"label": "Business License", "value": "BSL-SP20025-2026"},
    ]


def about_paragraphs():
    return [
        "Located in Kisauni, West “B” District, Zanzibar, AL NAMAA ACADEMY delivers "
        "high-quality education grounded in Islamic values. Our model combines rigorous "
        "academics with moral and spiritual development.",
        "Serving students from Nursery through Secondary level, we follow the ZEC Framework "
        "and NECTA curriculum — ensuring students are nationally competitive and globally prepared.",
    ]


def about_highlights():
    return [
        "ZEC Framework", "NECTA Aligned", "Islamic Values",
        "Ministry Accredited", "Holistic Growth",
    ]


def support_stats():
    return [
        {"value": "30%", "label": "Students Fully Sponsored"},
        {"value": "100%", "label": "Tuition Coverage"},
        {"value": "0", "label": "Children Turned Away"},
    ]


def stats_banner():
    return [
        {"value": "3", "label": "Education Levels", "sub": "Nursery • Primary • Secondary"},
        {"value": "100%", "label": "Government Accredited", "sub": "Ministry of Education, Zanzibar"},
        {"value": "ZEC", "label": "Curriculum Standard", "sub": "Zanzibar Examinations Council"},
        {"value": "NECTA", "label": "National Exam Board", "sub": "Tanzania & Zanzibar"},
    ]


def programs():
    return [
        {
            "number": "01", "level": "Nursery", "ages": "Early Childhood",
            "description": "Play-based and structured early childhood development. Building social, "
                           "cognitive, and physical foundations for lifelong learning.",
            "phone": "+255 774 221 707",
            "image": "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=700&q=80",
        },
        {
            "number": "02", "level": "Primary", "ages": "Foundation Stage",
            "description": "ZEC-aligned comprehensive curriculum developing literacy, numeracy, "
                           "critical thinking, and Islamic moral education.",
            "phone": "+255 652 898 731",
            "image": "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=700&q=80",
        },
        {
            "number": "03", "level": "Secondary", "ages": "Advanced Studies",
            "description": "Rigorous NECTA preparation across sciences, humanities, and technical "
                           "subjects — setting the stage for higher education.",
            "phone": "+255 777 397 422",
            "image": "https://images.unsplash.com/photo-1516534775068-ba3e7458af70?w=700&q=80",
        },
    ]


def features():
    return [
        {"icon": "book", "title": "Academic Excellence",
         "description": "Rigorous ZEC and NECTA-aligned curriculum designed to push students beyond national benchmarks."},
        {"icon": "heart", "title": "Islamic Values & Ethics",
         "description": "Faith-centred learning integrating Quran, Islamic studies, and moral development into daily life."},
        {"icon": "users", "title": "Holistic Development",
         "description": "Nurturing the intellectual, physical, social, emotional, and spiritual growth of every student."},
        {"icon": "shield", "title": "Safe & Modern Campus",
         "description": "Purpose-built facilities including laboratories, library, prayer spaces, and sport grounds."},
        {"icon": "globe", "title": "Inclusive Environment",
         "description": "Equal opportunity learning where every student is equally valued and supported to succeed."},
        {"icon": "award", "title": "Fully Accredited",
         "description": "Officially recognised and regularly inspected by the Ministry of Education, Zanzibar."},
    ]


def gallery():
    return [
        {"image": "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=700&q=80", "caption": "Collaborative Learning"},
        {"image": "https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=500&q=80", "caption": "Study Session"},
        {"image": "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=500&q=80", "caption": "School Library"},
        {"image": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&q=80", "caption": "Science Laboratory"},
        {"image": "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=500&q=80", "caption": "School Sports"},
        {"image": "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=500&q=80", "caption": "Teacher & Students"},
    ]


def admission_levels():
    return [
        "Nursery — Early Childhood Education",
        "Primary — Foundation & Intermediate Learning",
        "Secondary — Advanced Academic Studies",
    ]


def contact_phones():
    return [
        {"label": "Nursery Enquiries", "value": "+255 774 221 707"},
        {"label": "Primary Enquiries", "value": "+255 652 898 731"},
        {"label": "Secondary Enquiries", "value": "+255 777 397 422"},
    ]


def nav_links():
    return [
        {"label": "About", "href": "/#about"},
        {"label": "Programs", "href": "/#programs"},
        {"label": "Admissions", "href": "/#admissions"},
        {"label": "News", "href": "/#news"},
        {"label": "Support", "href": "/support"},
        {"label": "Team", "href": "/team"},
        {"label": "Fundraisers", "href": "/fundraisers"},
        {"label": "Contact", "href": "/#contact"},
    ]


def about_images():
    return [
        {"image": "https://images.unsplash.com/photo-1588072432836-e10032774350?w=900&q=80",
         "alt": "Students in class"},
        {"image": "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=500&q=80",
         "alt": "Teacher"},
        {"image": "https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=500&q=80",
         "alt": "Students studying"},
    ]


def featured_news_post():
    return {
        "image": "https://images.unsplash.com/photo-1513258496099-48168024aec0?w=900&q=80",
        "date": "March 10, 2026",
        "title": "Students Excel in NECTA National Examinations",
        "excerpt": "Outstanding performance across NECTA examinations, with multiple students "
                   "achieving top national rankings — a testament to our academic rigour and the "
                   "dedication of our faculty and students.",
        "link": "",
    }


def news_cards():
    return [
        {
            "image": "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=600&q=80",
            "category": "Infrastructure", "date": "February 20, 2026",
            "title": "New Science Laboratory Officially Inaugurated",
            "excerpt": "State-of-the-art facilities opened, enhancing practical and experimental "
                       "learning across all science subjects.",
            "link": "",
        },
        {
            "image": "https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=600&q=80",
            "category": "Admissions", "date": "February 10, 2026",
            "title": "Admissions Open for the 2026/2027 Academic Session",
            "excerpt": "Applications now being accepted for all three educational levels at our "
                       "Kisauni campus.",
            "link": "",
        },
        {
            "image": "https://images.unsplash.com/photo-1516534775068-ba3e7458af70?w=600&q=80",
            "category": "Community", "date": "January 15, 2026",
            "title": "Annual Prize-Giving Day Celebrates Student Achievement",
            "excerpt": "Top performers honoured in a ceremony attended by families, faculty, and "
                       "community leaders.",
            "link": "",
        },
    ]


def footer_registration_lines():
    return [
        "Reg. No. P 10082026  |  ZRB: Z052610299",
        "TIN: 175-002-324  |  BSL-SP20025-2026/51066",
    ]


def footer_school_links():
    return [
        {"label": "About Us", "href": "/#about"},
        {"label": "Our Programs", "href": "/#programs"},
        {"label": "Admissions", "href": "/#admissions"},
        {"label": "Campus Life", "href": "/#gallery"},
        {"label": "News", "href": "/#news"},
    ]


def footer_portal_links():
    return [
        {"label": "Student Portal", "href": "/login"},
        {"label": "Parent Portal", "href": "/login"},
        {"label": "Staff Portal", "href": "/login"},
        {"label": "Results Portal", "href": "/login"},
        {"label": "Admin Login", "href": "/login"},
    ]
