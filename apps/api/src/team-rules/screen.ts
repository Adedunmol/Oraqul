// What a team may not make a rule of. Checked in code on every candidate, whatever a model says, so
// a rule can never change what Oraqul tells the truth about, how it is run, or who it excludes.

export const REJECTIONS = {
  discrimination:
    'A rule cannot require treating people differently because of who they are: race, ethnicity, religion, gender, sexual orientation, disability or similar. A rule against discriminatory content is fine.',
  honesty:
    'A rule cannot change what Oraqul reports: verdicts, scores, confidence and what could not be tested come from the data and are not for a team to hide or turn up.',
  operational:
    'A rule cannot instruct the model or Oraqul’s own operation, or make it send, post or publish anything. Team defaults describe your launch, not how Oraqul works.',
} as const;
export type Rejection = keyof typeof REJECTIONS;

const TRAITS =
  'black|white|asian|latino|latina|arab|african|muslim|muslims|christian|christians|jewish|hindu|buddhist|gay|lesbian|bisexual|trans|transgender|queer|lgbtq\\w*|women|woman|men|man|female|male|disabled|immigrants?|refugees?|elderly|older|pregnant';
const PEOPLE =
  '(?:people|persons?|artists?|actors?|creators?|audiences?|fans|users|customers|talent|performers|writers|directors|guests|speakers|hosts|influencers)';

// A verb that excludes or singles out, then a trait, which is not met by "men's grooming" or by a
// rule against homophobic content, since neither names a trait as a group of people.
const DISCRIMINATION = new RegExp(
  String.raw`\b(?:exclude|excluding|avoid|ban|refuse|reject|never\s+(?:target|market\s+to|feature|hire|book|cast|include|show|work\s+with|use)|don'?t\s+(?:target|market\s+to|feature|hire|book|cast|include|show|work\s+with|use)|do\s+not\s+(?:target|market\s+to|feature|hire|book|cast|include|show|work\s+with|use)|only\s+(?:target|market\s+to|feature|hire|book|cast|work\s+with)|no)\s+(?:any\s+|all\s+)?(?:\w+\s+){0,2}(?:${TRAITS})\s+${PEOPLE}\b|\b(?:exclude|excluding|avoid|only\s+(?:target|market\s+to|feature|hire|book|cast|work\s+with)|never\s+(?:target|market\s+to|feature|hire|book|cast|include|work\s+with)|don'?t\s+(?:target|market\s+to|feature|hire|book|cast|include|work\s+with)|do\s+not\s+(?:target|market\s+to|feature|hire|book|cast|include|work\s+with))\s+(?:any\s+|all\s+)?(?:${TRAITS})\b(?!['’]s)`,
  'i',
);

const HONESTY =
  /\b(?:never|don'?t|do\s+not|stop|avoid|no\s+need\s+to)\s+(?:say|saying|write|writing|state|stating|mention|mentioning|show|showing|report|reporting)\b[^.\n]{0,40}\b(?:unknown|could\s+not\s+(?:be\s+)?test\w*|not\s+tested|uncertain\w*|confidence|weak|breaks?|risks?|limits?|gaps?)\b|mark\s+(?:everything|all|every\w*)\b[^.\n]{0,20}\b(?:supported|holds?|okay|ok|strong)\b|always\s+(?:say|mark|call|rate|score)\b[^.\n]{0,40}\b(?:holds?|supported|okay|strong|good|high)\b|\b(?:hide|conceal|remove)\s+(?:the\s+)?(?:weak|breaks?|risks?|gaps?|limits?|verdicts?|unknowns?)\b|\b(?:raise|boost|increase|inflate)\s+(?:the\s+)?(?:confidence|scores?|verdicts?)\b|\b(?:override|change|set)\s+(?:the\s+)?(?:verdicts?|scores?|confidence|lift|numbers?)\b/i;

const OPERATIONAL =
  /\b(?:ignore|disregard|forget|override)\s+(?:all\s+|any\s+|the\s+)?(?:previous|prior|above|earlier|other|your)?\s*(?:instructions?|rules?|prompts?|refusals?)\b|\byou\s+(?:must|are|will|should|have\s+to)\b|\b(?:system|developer)\s+prompt\b|\b(?:send|email|post|publish|dm|message|tweet|text)\b[^.\n]{0,40}\b(?:automatically|on\s+our\s+behalf|for\s+us|without\s+(?:asking|approval|checking)|by\s+yourself)\b|\bauto-?(?:send|post|publish)\b|\b(?:call|run|use|invoke)\s+(?:the\s+)?(?:api|tool|function|plugin)\b|\bforecast\b[^.\n]{0,30}\b(?:sales|box\s+office|numbers?)\b/i;

/** The reason a rule's words are not allowed, or null. */
export function screenText(text: string): Rejection | null {
  if (OPERATIONAL.test(text)) return 'operational';
  if (HONESTY.test(text)) return 'honesty';
  if (DISCRIMINATION.test(text)) return 'discrimination';
  return null;
}
