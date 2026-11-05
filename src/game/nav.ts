// Where everything lives now that the side panel is gone: the levels are in the top bar's
// progress track, and these field-guide chapters are listed in its level menu and the footer.

export const FIELD_GUIDE: { route: string; label: string }[] = [
  { route: 'overview', label: 'The big picture' },
  { route: 'spending', label: 'Where it goes' },
  { route: 'revenue', label: 'Where it comes from' },
  { route: 'receipt', label: 'Your tax receipt' },
  { route: 'state', label: 'Your state & district' },
  { route: 'gap', label: 'Deficits & the structural gap' },
  { route: 'debt', label: 'Debt & interest' },
  { route: 'process', label: 'How Congress budgets' },
  { route: 'laws', label: 'Laws that moved the needle' },
  { route: 'social-security', label: 'Social Security’s future' },
];

export const REFERENCE = [
  { route: 'glossary', label: 'Glossary' },
  { route: 'sources', label: 'Sources & methods' },
];
