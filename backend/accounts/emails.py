"""Localized transactional emails.

Reset + invitation emails are localized to the recipient's language (we know it:
the reset target is an existing user; an invite to an existing account uses their
stored language). Signup verification stays English — that account has no language
preference yet. Unknown/blank language falls back to English.

Each entry is {lang: (subject, body)}; bodies are str.format templates. The prose
in non-Latin scripts contains no literal braces, so .format() is safe.
"""

from django.conf import settings
from django.core.mail import send_mail

HELLO = {
    "en": "Hello", "es": "Hola", "fr": "Bonjour", "de": "Hallo", "it": "Ciao",
    "pt": "Olá", "zh": "你好", "hi": "नमस्ते", "bn": "হ্যালো", "ta": "வணக்கம்",
    "te": "నమస్తే", "mr": "नमस्कार", "gu": "નમસ્તે",
}

ROLE = {
    "en": {"admin": "an Admin", "member": "a Member"},
    "es": {"admin": "Administrador", "member": "Miembro"},
    "fr": {"admin": "Administrateur", "member": "Membre"},
    "de": {"admin": "Administrator", "member": "Mitglied"},
    "it": {"admin": "Amministratore", "member": "Membro"},
    "pt": {"admin": "Administrador", "member": "Membro"},
    "zh": {"admin": "管理员", "member": "成员"},
    "hi": {"admin": "व्यवस्थापक", "member": "सदस्य"},
    "bn": {"admin": "প্রশাসক", "member": "সদস্য"},
    "ta": {"admin": "நிர்வாகி", "member": "உறுப்பினர்"},
    "te": {"admin": "నిర్వాహకుడు", "member": "సభ్యుడు"},
    "mr": {"admin": "प्रशासक", "member": "सदस्य"},
    "gu": {"admin": "વ્યવસ્થાપક", "member": "સભ્ય"},
}

RESET = {
    "en": ("Reset your Ananda Taskboard password",
           "{greeting}\n\nWe received a request to reset your Ananda Taskboard password. "
           "Use the link below to choose a new one (it expires in 1 hour):\n\n{link}\n\n"
           "If you didn't request this, you can safely ignore this email."),
    "es": ("Restablece tu contraseña de Ananda Taskboard",
           "{greeting}\n\nRecibimos una solicitud para restablecer tu contraseña de Ananda Taskboard. "
           "Usa el siguiente enlace para crear una nueva (caduca en 1 hora):\n\n{link}\n\n"
           "Si no lo solicitaste, puedes ignorar este correo."),
    "fr": ("Réinitialisez votre mot de passe Ananda Taskboard",
           "{greeting}\n\nNous avons reçu une demande de réinitialisation de votre mot de passe Ananda Taskboard. "
           "Utilisez le lien ci-dessous pour en choisir un nouveau (il expire dans 1 heure) :\n\n{link}\n\n"
           "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail."),
    "de": ("Setzen Sie Ihr Ananda-Taskboard-Passwort zurück",
           "{greeting}\n\nWir haben eine Anfrage zum Zurücksetzen Ihres Ananda-Taskboard-Passworts erhalten. "
           "Über den folgenden Link können Sie ein neues festlegen (er läuft in 1 Stunde ab):\n\n{link}\n\n"
           "Falls Sie dies nicht angefordert haben, können Sie diese E-Mail ignorieren."),
    "it": ("Reimposta la tua password di Ananda Taskboard",
           "{greeting}\n\nAbbiamo ricevuto una richiesta di reimpostazione della tua password di Ananda Taskboard. "
           "Usa il link qui sotto per sceglierne una nuova (scade tra 1 ora):\n\n{link}\n\n"
           "Se non hai effettuato questa richiesta, puoi ignorare questa email."),
    "pt": ("Redefina sua senha do Ananda Taskboard",
           "{greeting}\n\nRecebemos um pedido para redefinir sua senha do Ananda Taskboard. "
           "Use o link abaixo para criar uma nova (ele expira em 1 hora):\n\n{link}\n\n"
           "Se você não solicitou isso, pode ignorar este e-mail."),
    "zh": ("重置你的 Ananda Taskboard 密码",
           "{greeting}\n\n我们收到了重置你的 Ananda Taskboard 密码的请求。请使用下方链接设置新密码（1 小时后失效）：\n\n{link}\n\n"
           "如果这不是你本人操作，可忽略此邮件。"),
    "hi": ("अपना Ananda Taskboard पासवर्ड रीसेट करें",
           "{greeting}\n\nहमें आपका Ananda Taskboard पासवर्ड रीसेट करने का अनुरोध मिला। "
           "नया पासवर्ड चुनने के लिए नीचे दिए गए लिंक का उपयोग करें (यह 1 घंटे में समाप्त हो जाएगा):\n\n{link}\n\n"
           "यदि आपने यह अनुरोध नहीं किया, तो इस ईमेल को अनदेखा कर सकते हैं।"),
    "bn": ("আপনার Ananda Taskboard পাসওয়ার্ড রিসেট করুন",
           "{greeting}\n\nআমরা আপনার Ananda Taskboard পাসওয়ার্ড রিসেট করার একটি অনুরোধ পেয়েছি। "
           "নিচের লিঙ্কটি ব্যবহার করে একটি নতুন পাসওয়ার্ড বেছে নিন (এটি ১ ঘণ্টায় মেয়াদ শেষ হবে):\n\n{link}\n\n"
           "আপনি যদি এটি অনুরোধ না করে থাকেন, তবে এই ইমেলটি উপেক্ষা করতে পারেন।"),
    "ta": ("உங்கள் Ananda Taskboard கடவுச்சொல்லை மீட்டமைக்கவும்",
           "{greeting}\n\nஉங்கள் Ananda Taskboard கடவுச்சொல்லை மீட்டமைக்க ஒரு கோரிக்கையைப் பெற்றோம். "
           "புதியதை அமைக்க கீழே உள்ள இணைப்பைப் பயன்படுத்தவும் (இது 1 மணி நேரத்தில் காலாவதியாகும்):\n\n{link}\n\n"
           "நீங்கள் இதைக் கோரவில்லை என்றால், இந்த மின்னஞ்சலைப் புறக்கணிக்கலாம்."),
    "te": ("మీ Ananda Taskboard పాస్‌వర్డ్‌ను రీసెట్ చేయండి",
           "{greeting}\n\nమీ Ananda Taskboard పాస్‌వర్డ్‌ను రీసెట్ చేయమని మాకు అభ్యర్థన వచ్చింది. "
           "కొత్తదాన్ని ఎంచుకోవడానికి దిగువ లింక్‌ను ఉపయోగించండి (ఇది 1 గంటలో గడువు ముగుస్తుంది):\n\n{link}\n\n"
           "మీరు దీన్ని అభ్యర్థించకపోతే, ఈ ఇమెయిల్‌ను విస్మరించవచ్చు."),
    "mr": ("तुमचा Ananda Taskboard पासवर्ड रीसेट करा",
           "{greeting}\n\nआम्हाला तुमचा Ananda Taskboard पासवर्ड रीसेट करण्याची विनंती मिळाली. "
           "नवीन निवडण्यासाठी खालील दुवा वापरा (तो 1 तासात कालबाह्य होईल):\n\n{link}\n\n"
           "तुम्ही ही विनंती केली नसेल, तर हा ईमेल दुर्लक्षित करू शकता."),
    "gu": ("તમારો Ananda Taskboard પાસવર્ડ રીસેટ કરો",
           "{greeting}\n\nઅમને તમારો Ananda Taskboard પાસવર્ડ રીસેટ કરવાની વિનંતી મળી. "
           "નવો પસંદ કરવા માટે નીચેની લિંકનો ઉપયોગ કરો (તે 1 કલાકમાં સમાપ્ત થશે):\n\n{link}\n\n"
           "જો તમે આ વિનંતી ન કરી હોય, તો આ ઇમેઇલને અવગણી શકો છો."),
}

INVITE = {
    "en": ("You're invited to join {org} on Ananda Taskboard",
           "{greeting}\n\n{inviter} has invited you to join {org} on Ananda Taskboard as {role}. "
           "Accept the invitation using the link below (it expires in {days} days):\n\n{link}\n\n"
           "If you weren't expecting this, you can ignore this email."),
    "es": ("Te invitan a unirte a {org} en Ananda Taskboard",
           "{greeting}\n\n{inviter} te ha invitado a unirte a {org} en Ananda Taskboard como {role}. "
           "Acepta la invitación con el siguiente enlace (caduca en {days} días):\n\n{link}\n\n"
           "Si no lo esperabas, puedes ignorar este correo."),
    "fr": ("Vous êtes invité à rejoindre {org} sur Ananda Taskboard",
           "{greeting}\n\n{inviter} vous a invité à rejoindre {org} sur Ananda Taskboard en tant que {role}. "
           "Acceptez l'invitation via le lien ci-dessous (il expire dans {days} jours) :\n\n{link}\n\n"
           "Si vous ne vous y attendiez pas, ignorez cet e-mail."),
    "de": ("Sie sind eingeladen, {org} auf Ananda Taskboard beizutreten",
           "{greeting}\n\n{inviter} hat Sie eingeladen, {org} auf Ananda Taskboard als {role} beizutreten. "
           "Nehmen Sie die Einladung über den folgenden Link an (er läuft in {days} Tagen ab):\n\n{link}\n\n"
           "Falls Sie dies nicht erwartet haben, können Sie diese E-Mail ignorieren."),
    "it": ("Sei invitato a unirti a {org} su Ananda Taskboard",
           "{greeting}\n\n{inviter} ti ha invitato a unirti a {org} su Ananda Taskboard come {role}. "
           "Accetta l'invito tramite il link qui sotto (scade tra {days} giorni):\n\n{link}\n\n"
           "Se non te lo aspettavi, puoi ignorare questa email."),
    "pt": ("Você foi convidado para participar de {org} no Ananda Taskboard",
           "{greeting}\n\n{inviter} convidou você para participar de {org} no Ananda Taskboard como {role}. "
           "Aceite o convite pelo link abaixo (ele expira em {days} dias):\n\n{link}\n\n"
           "Se você não esperava isso, pode ignorar este e-mail."),
    "zh": ("邀请你加入 Ananda Taskboard 上的 {org}",
           "{greeting}\n\n{inviter} 邀请你以{role}身份加入 Ananda Taskboard 上的 {org}。"
           "请通过下方链接接受邀请（{days} 天后失效）：\n\n{link}\n\n如果你并未预期此邀请，可忽略此邮件。"),
    "hi": ("आपको Ananda Taskboard पर {org} में शामिल होने के लिए आमंत्रित किया गया है",
           "{greeting}\n\n{inviter} ने आपको Ananda Taskboard पर {org} में {role} के रूप में शामिल होने के लिए आमंत्रित किया है। "
           "नीचे दिए गए लिंक से आमंत्रण स्वीकार करें (यह {days} दिनों में समाप्त हो जाएगा):\n\n{link}\n\n"
           "यदि आपको इसकी अपेक्षा नहीं थी, तो इस ईमेल को अनदेखा कर सकते हैं।"),
    "bn": ("আপনাকে Ananda Taskboard-এ {org}-তে যোগ দিতে আমন্ত্রণ জানানো হয়েছে",
           "{greeting}\n\n{inviter} আপনাকে Ananda Taskboard-এ {org}-তে {role} হিসেবে যোগ দিতে আমন্ত্রণ জানিয়েছেন। "
           "নিচের লিঙ্ক দিয়ে আমন্ত্রণ গ্রহণ করুন (এটি {days} দিনে মেয়াদ শেষ হবে):\n\n{link}\n\n"
           "আপনি যদি এটি আশা না করে থাকেন, তবে এই ইমেলটি উপেক্ষা করতে পারেন।"),
    "ta": ("Ananda Taskboard-இல் {org}-இல் சேர உங்களை அழைக்கிறோம்",
           "{greeting}\n\n{inviter} உங்களை Ananda Taskboard-இல் {org}-இல் {role} ஆக சேர அழைத்துள்ளார். "
           "கீழே உள்ள இணைப்பைப் பயன்படுத்தி அழைப்பை ஏற்கவும் ({days} நாட்களில் காலாவதியாகும்):\n\n{link}\n\n"
           "இதை நீங்கள் எதிர்பார்க்கவில்லை என்றால், இந்த மின்னஞ்சலைப் புறக்கணிக்கலாம்."),
    "te": ("Ananda Taskboard లో {org}లో చేరమని మీకు ఆహ్వానం",
           "{greeting}\n\n{inviter} మిమ్మల్ని Ananda Taskboard లో {org}లో {role}గా చేరమని ఆహ్వానించారు. "
           "దిగువ లింక్‌ను ఉపయోగించి ఆహ్వానాన్ని అంగీకరించండి ({days} రోజుల్లో గడువు ముగుస్తుంది):\n\n{link}\n\n"
           "మీరు దీన్ని ఊహించకపోతే, ఈ ఇమెయిల్‌ను విస్మరించవచ్చు."),
    "mr": ("तुम्हाला Ananda Taskboard वर {org} मध्ये सामील होण्यासाठी आमंत्रित केले आहे",
           "{greeting}\n\n{inviter} यांनी तुम्हाला Ananda Taskboard वर {org} मध्ये {role} म्हणून सामील होण्यासाठी आमंत्रित केले आहे. "
           "खालील दुव्याने आमंत्रण स्वीकारा (ते {days} दिवसांत कालबाह्य होईल):\n\n{link}\n\n"
           "तुम्हाला याची अपेक्षा नसेल, तर हा ईमेल दुर्लक्षित करू शकता."),
    "gu": ("તમને Ananda Taskboard પર {org} માં જોડાવા આમંત્રણ આપવામાં આવ્યું છે",
           "{greeting}\n\n{inviter} એ તમને Ananda Taskboard પર {org} માં {role} તરીકે જોડાવા આમંત્રણ આપ્યું છે. "
           "નીચેની લિંકથી આમંત્રણ સ્વીકારો (તે {days} દિવસમાં સમાપ્ત થશે):\n\n{link}\n\n"
           "જો તમે આની અપેક્ષા ન રાખી હોય, તો આ ઇમેઇલને અવગણી શકો છો."),
}


def _g(table, lang):
    return table.get(lang) or table["en"]


def _greeting(lang, name):
    hello = _g(HELLO, lang)
    return f"{hello} {name}," if name else f"{hello},"


def send_reset(user, link):
    lang = user.language or "en"
    subject, body = _g(RESET, lang)
    send_mail(subject, body.format(greeting=_greeting(lang, user.name), link=link),
              settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=True)


def send_invite(invitation, link, *, recipient_name="", recipient_lang=""):
    """Localize to the recipient's language when we know it (existing account),
    else English. `invitation.invited_by` and org/role are interpolated."""
    lang = recipient_lang or "en"
    subject, body = _g(INVITE, lang)
    inviter = (invitation.invited_by.name or invitation.invited_by.email) if invitation.invited_by else "An admin"
    role = _g(ROLE, lang)[invitation.role]
    days = getattr(settings, "INVITE_TIMEOUT_DAYS", 14)
    send_mail(
        subject.format(org=invitation.organization.name),
        body.format(greeting=_greeting(lang, recipient_name), inviter=inviter,
                    org=invitation.organization.name, role=role, link=link, days=days),
        settings.DEFAULT_FROM_EMAIL, [invitation.email], fail_silently=True,
    )
