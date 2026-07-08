export function numberToFrenchWords(number: number): string {
  const units = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf"];
  const tens = ["", "dix", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante-dix", "quatre-vingts", "quatre-vingt-dix"];
  const teens = ["dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];

  function convertLessThanOneThousand(n: number): string {
    if (n === 0) return "";
    let result = "";
    const hundreds = Math.floor(n / 100);
    const remainder = n % 100;

    if (hundreds > 0) {
      if (hundreds === 1) {
        result += "cent ";
      } else {
        result += units[hundreds] + " cent" + (remainder === 0 ? "s " : " ");
      }
    }

    if (remainder > 0) {
      if (remainder < 10) {
        result += units[remainder] + " ";
      } else if (remainder < 20) {
        result += teens[remainder - 10] + " ";
      } else {
        const tenDigit = Math.floor(remainder / 10);
        const unitDigit = remainder % 10;
        
        if (tenDigit === 7 || tenDigit === 9) {
          result += tens[tenDigit - 1] + "-" + teens[unitDigit] + " ";
        } else {
          result += tens[tenDigit];
          if (unitDigit > 0) {
            result += (unitDigit === 1 ? " et un " : "-" + units[unitDigit] + " ");
          } else {
            result += " ";
          }
        }
      }
    }
    return result;
  }

  if (number === 0) return "zéro";

  let result = "";
  const millions = Math.floor(number / 1000000);
  let remainder = number % 1000000;
  const thousands = Math.floor(remainder / 1000);
  remainder = remainder % 1000;

  if (millions > 0) {
    if (millions === 1) {
      result += "un million ";
    } else {
      result += convertLessThanOneThousand(millions).trim() + " millions ";
    }
  }

  if (thousands > 0) {
    if (thousands === 1) {
      result += "mille ";
    } else {
      result += convertLessThanOneThousand(thousands).trim() + " mille ";
    }
  }

  if (remainder > 0) {
    result += convertLessThanOneThousand(remainder);
  }

  return result.trim().charAt(0).toUpperCase() + result.trim().slice(1);
}
