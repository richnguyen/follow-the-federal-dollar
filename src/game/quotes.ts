// One quote per level for the celebration card: on citizenship, responsibility, the future, and
// public finance, from Americans of different eras and parties (and one Supreme Court justice).
// Wording follows the published texts; long passages are shortened with ellipses.

export interface Quote { text: string; who: string; where: string }

export const QUOTES: Record<string, Quote> = {
  'level-1': { text: 'Taxes are what we pay for civilized society.', who: 'Oliver Wendell Holmes Jr.', where: 'Dissent in Compañía General de Tabacos de Filipinas v. Collector of Internal Revenue, 1927' },
  'level-2': { text: 'I place economy among the first and most important of republican virtues, and public debt as the greatest of the dangers to be feared.', who: 'Thomas Jefferson', where: 'Letter to William Plumer, July 21, 1816' },
  'level-3': { text: 'And so, my fellow Americans: ask not what your country can do for you—ask what you can do for your country.', who: 'John F. Kennedy', where: 'Inaugural address, January 20, 1961' },
  'level-4': { text: 'As a very important source of strength and security, cherish public credit… not ungenerously throwing upon posterity the burden which we ourselves ought to bear.', who: 'George Washington', where: 'Farewell Address, 1796' },
  'level-5': { text: 'We cannot mortgage the material assets of our grandchildren without risking the loss also of their political and spiritual heritage.', who: 'Dwight D. Eisenhower', where: 'Farewell address, January 17, 1961' },
  'level-6': { text: 'A national debt, if it is not excessive, will be to us a national blessing.', who: 'Alexander Hamilton', where: 'Letter to Robert Morris, April 30, 1781' },
  'level-7': { text: 'This power over the purse may, in fact, be regarded as the most complete and effectual weapon with which any constitution can arm the immediate representatives of the people.', who: 'James Madison', where: 'The Federalist No. 58, 1788' },
  'level-8': { text: 'Fellow-citizens, we cannot escape history.', who: 'Abraham Lincoln', where: 'Annual message to Congress, December 1, 1862' },
  'level-9': { text: 'We have tried to frame a law which will give some measure of protection to the average citizen and to his family against the loss of a job and against poverty-ridden old age.', who: 'Franklin D. Roosevelt', where: 'Statement on signing the Social Security Act, August 14, 1935' },
  'level-10': { text: 'We cannot always build the future for our youth, but we can build our youth for the future.', who: 'Franklin D. Roosevelt', where: 'Address at the University of Pennsylvania, September 20, 1940' },
};
