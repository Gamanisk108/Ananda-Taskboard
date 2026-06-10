# One-shot: adds the 2026-06-10 conformance keys to all 13 locales and fixes
# the flagged platform.tier mistranslation ("Tier/Level" -> "View Access").
# Run: backend/venv/Scripts/python.exe frontend/scripts/add-keys-2026-06-10.py
import json
from pathlib import Path

LOC = Path(__file__).resolve().parents[1] / "src" / "locales"

NEW = {
    "en": {
        "approvals.confirmReject": "Reject this task? The member's submission is discarded.",
        "approvals.confirmRejectN": "Reject {{n}} pending task(s)? The members' submissions are discarded.",
        "trc.remove": "Remove",
        "trc.removeHint": "Withdraw your suggestion for this phrase",
        "trv.dismiss": "Remove suggestion",
        "trv.dismissConfirm": "Remove the suggestion “{{text}}” from this poll? This can't be undone.",
    },
    "de": {
        "approvals.confirmReject": "Diese Aufgabe ablehnen? Die Einreichung des Mitglieds wird verworfen.",
        "approvals.confirmRejectN": "{{n}} ausstehende Aufgabe(n) ablehnen? Die Einreichungen werden verworfen.",
        "trc.remove": "Entfernen",
        "trc.removeHint": "Ihren Vorschlag für diesen Text zurückziehen",
        "trv.dismiss": "Vorschlag entfernen",
        "trv.dismissConfirm": "Den Vorschlag „{{text}}“ aus dieser Umfrage entfernen? Dies kann nicht rückgängig gemacht werden.",
        "platform.tier": "Ansichtsrechte",
    },
    "es": {
        "approvals.confirmReject": "¿Rechazar esta tarea? La propuesta del miembro se descartará.",
        "approvals.confirmRejectN": "¿Rechazar {{n}} tarea(s) pendiente(s)? Las propuestas se descartarán.",
        "trc.remove": "Quitar",
        "trc.removeHint": "Retirar tu sugerencia para esta frase",
        "trv.dismiss": "Quitar sugerencia",
        "trv.dismissConfirm": "¿Quitar la sugerencia «{{text}}» de esta encuesta? Esto no se puede deshacer.",
        "platform.tier": "Acceso de visualización",
    },
    "fr": {
        "approvals.confirmReject": "Rejeter cette tâche ? La proposition du membre sera supprimée.",
        "approvals.confirmRejectN": "Rejeter {{n}} tâche(s) en attente ? Les propositions seront supprimées.",
        "trc.remove": "Retirer",
        "trc.removeHint": "Retirer votre suggestion pour cette phrase",
        "trv.dismiss": "Supprimer la suggestion",
        "trv.dismissConfirm": "Supprimer la suggestion « {{text}} » de ce sondage ? Cette action est irréversible.",
        "platform.tier": "Accès de consultation",
    },
    "it": {
        "approvals.confirmReject": "Rifiutare questa attività? La proposta del membro verrà scartata.",
        "approvals.confirmRejectN": "Rifiutare {{n}} attività in attesa? Le proposte verranno scartate.",
        "trc.remove": "Rimuovi",
        "trc.removeHint": "Ritira il tuo suggerimento per questa frase",
        "trv.dismiss": "Rimuovi suggerimento",
        "trv.dismissConfirm": "Rimuovere il suggerimento «{{text}}» da questo sondaggio? L'azione non può essere annullata.",
        "platform.tier": "Accesso di visualizzazione",
    },
    "pt": {
        "approvals.confirmReject": "Rejeitar esta tarefa? A proposta do membro será descartada.",
        "approvals.confirmRejectN": "Rejeitar {{n}} tarefa(s) pendente(s)? As propostas serão descartadas.",
        "trc.remove": "Remover",
        "trc.removeHint": "Retirar a sua sugestão para esta frase",
        "trv.dismiss": "Remover sugestão",
        "trv.dismissConfirm": "Remover a sugestão «{{text}}» desta votação? Isto não pode ser desfeito.",
        "platform.tier": "Acesso de visualização",
    },
    "zh": {
        "approvals.confirmReject": "拒绝此任务？成员提交的内容将被丢弃。",
        "approvals.confirmRejectN": "拒绝 {{n}} 个待审任务？提交的内容将被丢弃。",
        "trc.remove": "移除",
        "trc.removeHint": "撤回您对该短语的建议",
        "trv.dismiss": "移除建议",
        "trv.dismissConfirm": "从此投票中移除建议“{{text}}”？此操作无法撤销。",
        "platform.tier": "查看权限",
    },
    "hi": {
        "approvals.confirmReject": "इस कार्य को अस्वीकार करें? सदस्य का प्रस्ताव हटा दिया जाएगा।",
        "approvals.confirmRejectN": "{{n}} लंबित कार्य अस्वीकार करें? प्रस्ताव हटा दिए जाएँगे।",
        "trc.remove": "हटाएँ",
        "trc.removeHint": "इस वाक्यांश के लिए अपना सुझाव वापस लें",
        "trv.dismiss": "सुझाव हटाएँ",
        "trv.dismissConfirm": "इस मतदान से सुझाव “{{text}}” हटाएँ? इसे पूर्ववत नहीं किया जा सकता।",
        "platform.tier": "देखने की पहुँच",
    },
    "bn": {
        "approvals.confirmReject": "এই কাজটি প্রত্যাখ্যান করবেন? সদস্যের জমা বাতিল হয়ে যাবে।",
        "approvals.confirmRejectN": "{{n}}টি অপেক্ষমাণ কাজ প্রত্যাখ্যান করবেন? জমাগুলি বাতিল হয়ে যাবে।",
        "trc.remove": "সরান",
        "trc.removeHint": "এই বাক্যাংশের জন্য আপনার পরামর্শ প্রত্যাহার করুন",
        "trv.dismiss": "পরামর্শ সরান",
        "trv.dismissConfirm": "এই ভোট থেকে “{{text}}” পরামর্শটি সরাবেন? এটি আর ফেরানো যাবে না।",
        "platform.tier": "দেখার অ্যাক্সেস",
    },
    "gu": {
        "approvals.confirmReject": "આ કાર્યને નકારશો? સભ્યની રજૂઆત કાઢી નાખવામાં આવશે.",
        "approvals.confirmRejectN": "{{n}} બાકી કાર્યો નકારશો? રજૂઆતો કાઢી નાખવામાં આવશે.",
        "trc.remove": "દૂર કરો",
        "trc.removeHint": "આ વાક્ય માટે તમારું સૂચન પાછું ખેંચો",
        "trv.dismiss": "સૂચન દૂર કરો",
        "trv.dismissConfirm": "આ મતદાનમાંથી “{{text}}” સૂચન દૂર કરશો? આ પાછું વાળી શકાશે નહીં.",
        "platform.tier": "જોવાની ઍક્સેસ",
    },
    "mr": {
        "approvals.confirmReject": "हे कार्य नाकारायचे? सदस्याने सादर केलेले काढून टाकले जाईल.",
        "approvals.confirmRejectN": "{{n}} प्रलंबित कार्ये नाकारायची? सादरीकरणे काढून टाकली जातील.",
        "trc.remove": "काढा",
        "trc.removeHint": "या वाक्यांशासाठी तुमची सूचना मागे घ्या",
        "trv.dismiss": "सूचना काढा",
        "trv.dismissConfirm": "या मतदानातून “{{text}}” सूचना काढायची? हे पूर्ववत करता येणार नाही.",
        "platform.tier": "पाहण्याचा प्रवेश",
    },
    "ta": {
        "approvals.confirmReject": "இந்தப் பணியை நிராகரிக்கவா? உறுப்பினரின் சமர்ப்பிப்பு நீக்கப்படும்.",
        "approvals.confirmRejectN": "{{n}} நிலுவைப் பணிகளை நிராகரிக்கவா? சமர்ப்பிப்புகள் நீக்கப்படும்.",
        "trc.remove": "அகற்று",
        "trc.removeHint": "இந்தச் சொற்றொடருக்கான உங்கள் பரிந்துரையைத் திரும்பப் பெறுங்கள்",
        "trv.dismiss": "பரிந்துரையை அகற்று",
        "trv.dismissConfirm": "இந்த வாக்கெடுப்பிலிருந்து “{{text}}” பரிந்துரையை அகற்றவா? இதைச் செயல்தவிர்க்க முடியாது.",
        "platform.tier": "பார்வை அணுகல்",
    },
    "te": {
        "approvals.confirmReject": "ఈ పనిని తిరస్కరించాలా? సభ్యుని సమర్పణ తొలగించబడుతుంది.",
        "approvals.confirmRejectN": "{{n}} పెండింగ్ పనులను తిరస్కరించాలా? సమర్పణలు తొలగించబడతాయి.",
        "trc.remove": "తొలగించు",
        "trc.removeHint": "ఈ పదబంధానికి మీ సూచనను వెనక్కి తీసుకోండి",
        "trv.dismiss": "సూచనను తొలగించు",
        "trv.dismissConfirm": "ఈ పోల్ నుండి “{{text}}” సూచనను తొలగించాలా? దీన్ని రద్దు చేయలేరు.",
        "platform.tier": "వీక్షణ యాక్సెస్",
    },
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
    for dotted, value in entries.items():
        set_path(data, dotted, value)
    f.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{code}: +{len(entries)}")
print("done")
