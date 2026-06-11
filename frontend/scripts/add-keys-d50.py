# D50 keys (pending-approval visibility) for all 13 locales.
# Run: backend/venv/Scripts/python.exe frontend/scripts/add-keys-d50.py
import json
from pathlib import Path

LOC = Path(__file__).resolve().parents[1] / "src" / "locales"

NEW = {
    "en": {"summary.pending": "Pending approval", "menu.pendingApproval": "Pending approval", "wfa.title": "Waiting for approval", "wfa.sub": "Your submissions an admin hasn't reviewed yet. They stay on your board with a gold “Pending approval” pill until then.", "wfa.sortNew": "Newest first", "wfa.sortOld": "Oldest first", "wfa.empty": "Nothing waiting — everything you've sent has been reviewed.", "wfa.newChip": "NEW task", "wfa.requested": "Requested", "wfa.submitted": "Submitted", "wfa.sent": "sent {{date}}"},
    "de": {"summary.pending": "Wartet auf Freigabe", "menu.pendingApproval": "Wartet auf Freigabe", "wfa.title": "Wartet auf Freigabe", "wfa.sub": "Ihre Einreichungen, die noch kein Admin geprüft hat. Sie bleiben mit einer goldenen Markierung auf Ihrem Board.", "wfa.sortNew": "Neueste zuerst", "wfa.sortOld": "Älteste zuerst", "wfa.empty": "Nichts offen — alles Eingereichte wurde geprüft.", "wfa.newChip": "NEUE Aufgabe", "wfa.requested": "Angefragt", "wfa.submitted": "Eingereicht", "wfa.sent": "gesendet {{date}}"},
    "es": {"summary.pending": "Pendiente de aprobación", "menu.pendingApproval": "Pendiente de aprobación", "wfa.title": "En espera de aprobación", "wfa.sub": "Tus envíos que un administrador aún no ha revisado. Permanecen en tu tablero con una etiqueta dorada.", "wfa.sortNew": "Más recientes primero", "wfa.sortOld": "Más antiguos primero", "wfa.empty": "Nada en espera — todo lo enviado ya fue revisado.", "wfa.newChip": "Tarea NUEVA", "wfa.requested": "Solicitado", "wfa.submitted": "Enviado", "wfa.sent": "enviado {{date}}"},
    "fr": {"summary.pending": "En attente d'approbation", "menu.pendingApproval": "En attente d'approbation", "wfa.title": "En attente d'approbation", "wfa.sub": "Vos envois qu'un administrateur n'a pas encore examinés. Ils restent sur votre tableau avec une pastille dorée.", "wfa.sortNew": "Plus récents d'abord", "wfa.sortOld": "Plus anciens d'abord", "wfa.empty": "Rien en attente — tout ce que vous avez envoyé a été examiné.", "wfa.newChip": "NOUVELLE tâche", "wfa.requested": "Demandé", "wfa.submitted": "Envoyé", "wfa.sent": "envoyé {{date}}"},
    "it": {"summary.pending": "In attesa di approvazione", "menu.pendingApproval": "In attesa di approvazione", "wfa.title": "In attesa di approvazione", "wfa.sub": "I tuoi invii che un amministratore non ha ancora esaminato. Restano sulla tua bacheca con un'etichetta dorata.", "wfa.sortNew": "Più recenti prima", "wfa.sortOld": "Più vecchi prima", "wfa.empty": "Niente in attesa — tutto ciò che hai inviato è stato esaminato.", "wfa.newChip": "NUOVA attività", "wfa.requested": "Richiesto", "wfa.submitted": "Inviato", "wfa.sent": "inviato {{date}}"},
    "pt": {"summary.pending": "A aguardar aprovação", "menu.pendingApproval": "A aguardar aprovação", "wfa.title": "A aguardar aprovação", "wfa.sub": "Os seus envios que um administrador ainda não reviu. Permanecem no seu quadro com uma etiqueta dourada.", "wfa.sortNew": "Mais recentes primeiro", "wfa.sortOld": "Mais antigos primeiro", "wfa.empty": "Nada em espera — tudo o que enviou foi revisto.", "wfa.newChip": "NOVA tarefa", "wfa.requested": "Pedido", "wfa.submitted": "Enviado", "wfa.sent": "enviado {{date}}"},
    "zh": {"summary.pending": "待审批", "menu.pendingApproval": "待审批", "wfa.title": "等待审批", "wfa.sub": "管理员尚未审核的提交。在此之前它们会带着金色“待审批”标签留在您的看板上。", "wfa.sortNew": "最新优先", "wfa.sortOld": "最早优先", "wfa.empty": "没有待审批的内容——您提交的都已审核。", "wfa.newChip": "新任务", "wfa.requested": "请求", "wfa.submitted": "提交时间", "wfa.sent": "提交于 {{date}}"},
    "hi": {"summary.pending": "अनुमोदन लंबित", "menu.pendingApproval": "अनुमोदन लंबित", "wfa.title": "अनुमोदन की प्रतीक्षा में", "wfa.sub": "आपके भेजे गए कार्य जिनकी समीक्षा अभी एडमिन ने नहीं की है। तब तक वे सुनहरे चिह्न के साथ आपके बोर्ड पर रहते हैं।", "wfa.sortNew": "नवीनतम पहले", "wfa.sortOld": "सबसे पुराने पहले", "wfa.empty": "कुछ भी लंबित नहीं — आपके सभी भेजे गए कार्य देखे जा चुके हैं।", "wfa.newChip": "नया कार्य", "wfa.requested": "अनुरोध", "wfa.submitted": "भेजा गया", "wfa.sent": "भेजा {{date}}"},
    "bn": {"summary.pending": "অনুমোদনের অপেক্ষায়", "menu.pendingApproval": "অনুমোদনের অপেক্ষায়", "wfa.title": "অনুমোদনের অপেক্ষায়", "wfa.sub": "আপনার পাঠানো কাজ যা অ্যাডমিন এখনও দেখেননি। ততক্ষণ সেগুলি সোনালি চিহ্ন সহ আপনার বোর্ডে থাকবে।", "wfa.sortNew": "নতুন আগে", "wfa.sortOld": "পুরনো আগে", "wfa.empty": "অপেক্ষায় কিছু নেই — পাঠানো সবকিছু দেখা হয়ে গেছে।", "wfa.newChip": "নতুন কাজ", "wfa.requested": "অনুরোধ", "wfa.submitted": "পাঠানো হয়েছে", "wfa.sent": "পাঠানো {{date}}"},
    "gu": {"summary.pending": "મંજૂરી બાકી", "menu.pendingApproval": "મંજૂરી બાકી", "wfa.title": "મંજૂરીની રાહમાં", "wfa.sub": "તમારી મોકલેલી રજૂઆતો જે એડમિને હજી જોઈ નથી. ત્યાં સુધી તે સોનેરી નિશાન સાથે તમારા બોર્ડ પર રહે છે.", "wfa.sortNew": "નવા પહેલા", "wfa.sortOld": "જૂના પહેલા", "wfa.empty": "કંઈ બાકી નથી — મોકલેલું બધું જોવાઈ ગયું છે.", "wfa.newChip": "નવું કાર્ય", "wfa.requested": "વિનંતી", "wfa.submitted": "મોકલ્યું", "wfa.sent": "મોકલ્યું {{date}}"},
    "mr": {"summary.pending": "मंजुरी प्रलंबित", "menu.pendingApproval": "मंजुरी प्रलंबित", "wfa.title": "मंजुरीच्या प्रतीक्षेत", "wfa.sub": "तुमची पाठवलेली कामे जी अ‍ॅडमिनने अजून पाहिली नाहीत. तोपर्यंत ती सोनेरी खुणेसह तुमच्या बोर्डवर राहतात.", "wfa.sortNew": "नवीन आधी", "wfa.sortOld": "जुने आधी", "wfa.empty": "काही प्रलंबित नाही — पाठवलेले सर्व पाहिले गेले आहे.", "wfa.newChip": "नवीन कार्य", "wfa.requested": "विनंती", "wfa.submitted": "पाठवले", "wfa.sent": "पाठवले {{date}}"},
    "ta": {"summary.pending": "ஒப்புதலுக்காக நிலுவையில்", "menu.pendingApproval": "ஒப்புதலுக்காக நிலுவையில்", "wfa.title": "ஒப்புதலுக்காகக் காத்திருக்கிறது", "wfa.sub": "நிர்வாகி இன்னும் பார்க்காத உங்கள் சமர்ப்பிப்புகள். அதுவரை அவை தங்க அடையாளத்துடன் உங்கள் பலகையில் இருக்கும்.", "wfa.sortNew": "புதியவை முதலில்", "wfa.sortOld": "பழையவை முதலில்", "wfa.empty": "எதுவும் நிலுவையில் இல்லை — அனுப்பிய அனைத்தும் பார்க்கப்பட்டன.", "wfa.newChip": "புதிய பணி", "wfa.requested": "கோரப்பட்டது", "wfa.submitted": "அனுப்பியது", "wfa.sent": "அனுப்பியது {{date}}"},
    "te": {"summary.pending": "ఆమోదం పెండింగ్", "menu.pendingApproval": "ఆమోదం పెండింగ్", "wfa.title": "ఆమోదం కోసం వేచి ఉంది", "wfa.sub": "అడ్మిన్ ఇంకా చూడని మీ సమర్పణలు. అప్పటి వరకు అవి బంగారు గుర్తుతో మీ బోర్డుపై ఉంటాయి.", "wfa.sortNew": "కొత్తవి ముందు", "wfa.sortOld": "పాతవి ముందు", "wfa.empty": "ఏదీ పెండింగ్‌లో లేదు — పంపినవన్నీ సమీక్షించబడ్డాయి.", "wfa.newChip": "కొత్త పని", "wfa.requested": "అభ్యర్థించింది", "wfa.submitted": "పంపింది", "wfa.sent": "పంపింది {{date}}"},
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
