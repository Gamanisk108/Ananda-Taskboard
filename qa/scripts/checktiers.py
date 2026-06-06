from accounts.models import Tier, Organization
from django.contrib.auth import get_user_model
U = get_user_model()
print("Tiers total:", Tier.objects.count())
for t in Tier.objects.all()[:20]:
    print("  tier", t.id, repr(t.name), "org=", t.organization_id)
admin = U.objects.filter(email="admin@ananda.test").first()
print("admin active_org:", getattr(admin, "active_org_id", None) if admin else "no admin")
print("orgs:", list(Organization.objects.values_list("id", "name")))
