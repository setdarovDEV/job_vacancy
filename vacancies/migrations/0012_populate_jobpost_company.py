from django.db import migrations

def forwards(apps, schema_editor):
    JobPost = apps.get_model('vacancies', 'JobPost')
    Company = apps.get_model('companies', 'Company')
    # Eski postlarda company yo'q bo'lsa, employer -> company.owner bo'yicha bog'laymiz
    for jp in JobPost.objects.filter(company__isnull=True):
        comp = Company.objects.filter(owner_id=jp.employer_id).first()
        if comp:
            jp.company_id = comp.id
            jp.save(update_fields=['company'])

def backwards(apps, schema_editor):
    JobPost = apps.get_model('vacancies', 'JobPost')
    JobPost.objects.update(company_id=None)

class Migration(migrations.Migration):

    dependencies = [
        ('vacancies', '0011_alter_jobpost_company_alter_jobpostrating_stars'),  # <-- aynan shu nom
        ('companies', '0001_initial'),  # yoki companies appdagi oxirgi initial nomi
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
