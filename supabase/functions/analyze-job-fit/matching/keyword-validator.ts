export function isKeywordInText(text: string, keyword: string, matchType: 'exact' | 'flexible'): boolean {
  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  
  if (matchType === 'exact') {
    const regex = new RegExp(`\\b${lowerKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return regex.test(text);
  } else {
    // Flexible matching (word-stem)
    const keywordWords = lowerKeyword.split(/\s+/).filter(w => w.length > 0);
    
    // Skip very short single words
    if (keywordWords.length === 1 && keywordWords[0].length <= 2) {
      return false;
    }
    
    return keywordWords.every(word => {
      // For very short words, require exact match
      if (word.length <= 3) {
        const regex = new RegExp(`\\b${word}\\b`, 'i');
        return regex.test(lowerText);
      }
      
      // For longer words, match stems
      const stem = word.replace(/(ing|ed|s|es|tion|ment|ly|ize|ise|ization|isation)$/i, '');
      
      if (stem.length < 3) {
        return lowerText.includes(word);
      }
      
      const stemRegex = new RegExp(`\\b\\w*${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\w*\\b`, 'i');
      return stemRegex.test(text);
    });
  }
}

export function verifyKeywordsInBullets(
  bulletPoints: Record<string, any[]>,
  allKeywords: string[],
  matchType: 'exact' | 'flexible'
): {
  verifiedBullets: Record<string, any[]>;
  actualKeywordsUsed: string[];
  actualKeywordsNotUsed: string[];
} {
  const allKeywordsInBullets = new Set<string>();
  const verifiedBullets: Record<string, any[]> = {};
  
  Object.entries(bulletPoints).forEach(([roleKey, bullets]) => {
    verifiedBullets[roleKey] = bullets.map((bullet: any) => {
      const claimedKeywords = bullet.keywordsUsed || [];
      const verifiedKeywords = claimedKeywords.filter((kw: string) => 
        isKeywordInText(bullet.text, kw, matchType)
      );
      
      verifiedKeywords.forEach((kw: string) => allKeywordsInBullets.add(kw));
      
      return {
        ...bullet,
        keywordsUsed: verifiedKeywords
      };
    });
  });
  
  const actualKeywordsUsed = Array.from(allKeywordsInBullets);
  const actualKeywordsNotUsed = allKeywords.filter(kw => !allKeywordsInBullets.has(kw));
  
  return {
    verifiedBullets,
    actualKeywordsUsed,
    actualKeywordsNotUsed
  };
}
