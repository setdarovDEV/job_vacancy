# vacancies/signals.py
from django.db.models.signals import post_save
from django.dispatch import receiver
from vacancies.models import JobPost
from companies.models import Company

@receiver(post_save, sender=JobPost)
def auto_assign_company(sender, instance, created, **kwargs):
    """
    Har safar yangi JobPost yaratilganda, agar company bo‘sh bo‘lsa —
    avtomatik ravishda shu employer’ning kompaniyasiga bog‘laydi.
    """
    if created and instance.company is None:
        company = Company.objects.filter(owner=instance.employer).first()
        if company:
            instance.company = company
            instance.save(update_fields=["company"])
            print(f"🏢 JobPost '{instance.title}' avtomatik {company.name} kompaniyasiga bog‘landi ✅")
