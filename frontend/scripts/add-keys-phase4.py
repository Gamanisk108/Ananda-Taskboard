# Phase-4 keys (legal links + account deletion) for all 13 locales.
# Run: backend/venv/Scripts/python.exe frontend/scripts/add-keys-phase4.py
import json
from pathlib import Path

LOC = Path(__file__).resolve().parents[1] / "src" / "locales"

NEW = {
    "en": {"legal.privacy": "Privacy Policy", "legal.terms": "Terms of Service", "settings.deleteAccount": "Delete account", "settings.deleteAccountSub": "This permanently removes your account, sign-in, and personal data. Tasks and comments your team still needs stay, without your name on them. This can't be undone.", "settings.deleteConfirmPw": "Enter your password to confirm", "settings.deleteAccountCta": "Delete my account", "settings.deleteError": "Couldn't delete the account."},
    "de": {"legal.privacy": "Datenschutzerklärung", "legal.terms": "Nutzungsbedingungen", "settings.deleteAccount": "Konto löschen", "settings.deleteAccountSub": "Dies entfernt Ihr Konto, Ihre Anmeldung und Ihre persönlichen Daten dauerhaft. Aufgaben und Kommentare, die Ihr Team noch braucht, bleiben ohne Ihren Namen erhalten. Dies kann nicht rückgängig gemacht werden.", "settings.deleteConfirmPw": "Geben Sie zur Bestätigung Ihr Passwort ein", "settings.deleteAccountCta": "Mein Konto löschen", "settings.deleteError": "Das Konto konnte nicht gelöscht werden."},
    "es": {"legal.privacy": "Política de privacidad", "legal.terms": "Términos del servicio", "settings.deleteAccount": "Eliminar cuenta", "settings.deleteAccountSub": "Esto elimina permanentemente tu cuenta, tu acceso y tus datos personales. Las tareas y comentarios que tu equipo aún necesita se conservan, sin tu nombre. Esto no se puede deshacer.", "settings.deleteConfirmPw": "Introduce tu contraseña para confirmar", "settings.deleteAccountCta": "Eliminar mi cuenta", "settings.deleteError": "No se pudo eliminar la cuenta."},
    "fr": {"legal.privacy": "Politique de confidentialité", "legal.terms": "Conditions d'utilisation", "settings.deleteAccount": "Supprimer le compte", "settings.deleteAccountSub": "Cela supprime définitivement votre compte, votre connexion et vos données personnelles. Les tâches et commentaires dont votre équipe a encore besoin restent, sans votre nom. Cette action est irréversible.", "settings.deleteConfirmPw": "Saisissez votre mot de passe pour confirmer", "settings.deleteAccountCta": "Supprimer mon compte", "settings.deleteError": "Impossible de supprimer le compte."},
    "it": {"legal.privacy": "Informativa sulla privacy", "legal.terms": "Termini di servizio", "settings.deleteAccount": "Elimina account", "settings.deleteAccountSub": "Questo rimuove definitivamente il tuo account, l'accesso e i dati personali. Le attività e i commenti che servono ancora al tuo team restano, senza il tuo nome. L'azione non può essere annullata.", "settings.deleteConfirmPw": "Inserisci la password per confermare", "settings.deleteAccountCta": "Elimina il mio account", "settings.deleteError": "Impossibile eliminare l'account."},
    "pt": {"legal.privacy": "Política de privacidade", "legal.terms": "Termos de serviço", "settings.deleteAccount": "Eliminar conta", "settings.deleteAccountSub": "Isto remove permanentemente a sua conta, o acesso e os dados pessoais. As tarefas e comentários de que a equipa ainda precisa permanecem, sem o seu nome. Isto não pode ser desfeito.", "settings.deleteConfirmPw": "Introduza a sua palavra-passe para confirmar", "settings.deleteAccountCta": "Eliminar a minha conta", "settings.deleteError": "Não foi possível eliminar a conta."},
    "zh": {"legal.privacy": "隐私政策", "legal.terms": "服务条款", "settings.deleteAccount": "删除账户", "settings.deleteAccountSub": "这将永久删除您的账户、登录信息和个人数据。团队仍需要的任务和评论将保留，但不再显示您的名字。此操作无法撤销。", "settings.deleteConfirmPw": "输入密码以确认", "settings.deleteAccountCta": "删除我的账户", "settings.deleteError": "无法删除账户。"},
    "hi": {"legal.privacy": "गोपनीयता नीति", "legal.terms": "सेवा की शर्तें", "settings.deleteAccount": "खाता हटाएँ", "settings.deleteAccountSub": "इससे आपका खाता, साइन-इन और व्यक्तिगत डेटा स्थायी रूप से हट जाएगा। टीम को जिन कार्यों और टिप्पणियों की अभी भी ज़रूरत है, वे आपके नाम के बिना बनी रहेंगी। इसे पूर्ववत नहीं किया जा सकता।", "settings.deleteConfirmPw": "पुष्टि के लिए अपना पासवर्ड दर्ज करें", "settings.deleteAccountCta": "मेरा खाता हटाएँ", "settings.deleteError": "खाता हटाया नहीं जा सका।"},
    "bn": {"legal.privacy": "গোপনীয়তা নীতি", "legal.terms": "পরিষেবার শর্তাবলী", "settings.deleteAccount": "অ্যাকাউন্ট মুছুন", "settings.deleteAccountSub": "এটি আপনার অ্যাকাউন্ট, সাইন-ইন এবং ব্যক্তিগত তথ্য স্থায়ীভাবে মুছে দেবে। দলের এখনও প্রয়োজনীয় কাজ ও মন্তব্য আপনার নাম ছাড়া থেকে যাবে। এটি আর ফেরানো যাবে না।", "settings.deleteConfirmPw": "নিশ্চিত করতে আপনার পাসওয়ার্ড দিন", "settings.deleteAccountCta": "আমার অ্যাকাউন্ট মুছুন", "settings.deleteError": "অ্যাকাউন্ট মোছা যায়নি।"},
    "gu": {"legal.privacy": "ગોપનીયતા નીતિ", "legal.terms": "સેવાની શરતો", "settings.deleteAccount": "ખાતું કાઢી નાખો", "settings.deleteAccountSub": "આ તમારું ખાતું, સાઇન-ઇન અને વ્યક્તિગત માહિતી કાયમ માટે દૂર કરશે. ટીમને હજી જરૂરી કાર્યો અને ટિપ્પણીઓ તમારા નામ વિના રહેશે. આ પાછું વાળી શકાશે નહીં.", "settings.deleteConfirmPw": "પુષ્ટિ માટે તમારો પાસવર્ડ દાખલ કરો", "settings.deleteAccountCta": "મારું ખાતું કાઢી નાખો", "settings.deleteError": "ખાતું કાઢી શકાયું નહીં."},
    "mr": {"legal.privacy": "गोपनीयता धोरण", "legal.terms": "सेवा अटी", "settings.deleteAccount": "खाते हटवा", "settings.deleteAccountSub": "यामुळे तुमचे खाते, साइन-इन आणि वैयक्तिक माहिती कायमची काढून टाकली जाईल. संघाला अजूनही आवश्यक असलेली कार्ये आणि टिप्पण्या तुमच्या नावाशिवाय राहतील. हे पूर्ववत करता येणार नाही.", "settings.deleteConfirmPw": "पुष्टीसाठी तुमचा पासवर्ड टाका", "settings.deleteAccountCta": "माझे खाते हटवा", "settings.deleteError": "खाते हटवता आले नाही."},
    "ta": {"legal.privacy": "தனியுரிமைக் கொள்கை", "legal.terms": "சேவை விதிமுறைகள்", "settings.deleteAccount": "கணக்கை நீக்கு", "settings.deleteAccountSub": "இது உங்கள் கணக்கு, உள்நுழைவு மற்றும் தனிப்பட்ட தரவை நிரந்தரமாக நீக்கும். அணிக்கு இன்னும் தேவையான பணிகளும் கருத்துகளும் உங்கள் பெயர் இல்லாமல் இருக்கும். இதைச் செயல்தவிர்க்க முடியாது.", "settings.deleteConfirmPw": "உறுதிப்படுத்த உங்கள் கடவுச்சொல்லை உள்ளிடவும்", "settings.deleteAccountCta": "என் கணக்கை நீக்கு", "settings.deleteError": "கணக்கை நீக்க முடியவில்லை."},
    "te": {"legal.privacy": "గోప్యతా విధానం", "legal.terms": "సేవా నిబంధనలు", "settings.deleteAccount": "ఖాతాను తొలగించు", "settings.deleteAccountSub": "ఇది మీ ఖాతా, సైన్-ఇన్ మరియు వ్యక్తిగత డేటాను శాశ్వతంగా తొలగిస్తుంది. బృందానికి ఇంకా అవసరమైన పనులు, వ్యాఖ్యలు మీ పేరు లేకుండా ఉంటాయి. దీన్ని రద్దు చేయలేరు.", "settings.deleteConfirmPw": "నిర్ధారించడానికి మీ పాస్‌వర్డ్ నమోదు చేయండి", "settings.deleteAccountCta": "నా ఖాతాను తొలగించు", "settings.deleteError": "ఖాతాను తొలగించలేకపోయాం."},
}


def set_path(obj, dotted, value):
    parts = dotted.split(".")
    cur = obj
    for p in parts[:-1]:
        cur = cur.setdefault(p, {})
    cur[parts[-1]] = value


for code, entries in NEW.items():
    f = LOC / f"{code}.json"
    data = json.loads(f.read_text(encoding="utf-8"))
    for k, v in entries.items():
        set_path(data, k, v)
    f.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("ok")
