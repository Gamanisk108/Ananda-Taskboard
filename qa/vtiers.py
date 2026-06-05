from accounts.models import Tier, Organization
print("ORGS", list(Organization.objects.values_list("id", "name")))
rows = ["%s|%s|%s|org=%s" % (t.id, t.name, t.default_sees, t.organization_id) for t in Tier.objects.all()]
print("TIERROWS", rows)
