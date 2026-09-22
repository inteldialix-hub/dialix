const DNC_KEYWORDS = [
  "don't call me",
  "stop calling",
  "remove my number",
  "take me off the list",
  "ne m'appelez plus",
  "supprimez mon numéro",
  "arrêtez de m'appeler",
  "retirez-moi de la liste",
  "ما تعاودش تعيط ليا",
  "حيد رقمي",
  "لا تتصل بي",
  "أوقف الاتصال"
];

function detectDncOptOut(text) {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  return DNC_KEYWORDS.some(kw => lowerText.includes(kw));
}

module.exports = { DNC_KEYWORDS, detectDncOptOut };
