function formatCitation(citation) {
  // first, coerce dates to proper format (e.g., y=2029, m=Jan., d=21 -> y=2029, m=01, d=21)
  const months = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ];
  if (citation.month) {
    citation.month = citation.month.toLowerCase();
    if (months.includes(citation.month)) {
      citation.month = months
        .indexOf(citation.month)
        .toString()
        .padStart(2, "0");
    }
    if (months.map((m) => m.slice(0, 3)).includes(citation.month)) {
      citation.month = months
        .map((m) => m.slice(0, 3))
        .indexOf(citation.month)
        .toString()
        .padStart(2, "0");
    }
    if (months.map((m) => m.slice(0, 4)).includes(citation.month)) {
      citation.month = months
        .map((m) => m.slice(0, 4))
        .indexOf(citation.month)
        .toString()
        .padStart(2, "0");
    }
    if (months.map((m) => m.slice(0, 3) + ".").includes(citation.month)) {
      citation.month = months
        .map((m) => m.slice(0, 3) + ".")
        .indexOf(citation.month)
        .toString()
        .padStart(2, "0");
    }
    if (months.map((m) => m.slice(0, 4) + ".").includes(citation.month)) {
      citation.month = months
        .map((m) => m.slice(0, 4) + ".")
        .indexOf(citation.month)
        .toString()
        .padStart(2, "0");
    }
  }
  // zero-pad day
  if (citation.day) {
    citation.day = String(citation.day).padStart(2, "0");
  }

  // format publication date the same way
  if (citation.publicationMonth) {
    citation.publicationMonth = citation.publicationMonth.toLowerCase();
    if (months.includes(citation.publicationMonth)) {
      citation.publicationMonth = months
        .indexOf(citation.publicationMonth)
        .toString()
        .padStart(2, "0");
    }
    if (months.map((m) => m.slice(0, 3)).includes(citation.publicationMonth)) {
      citation.publicationMonth = months
        .map((m) => m.slice(0, 3))
        .indexOf(citation.publicationMonth)
        .toString()
        .padStart(2, "0");
    }
    if (months.map((m) => m.slice(0, 4)).includes(citation.publicationMonth)) {
      citation.publicationMonth = months
        .map((m) => m.slice(0, 4))
        .indexOf(citation.publicationMonth)
        .toString()
        .padStart(2, "0");
    }
    if (
      months.map((m) => m.slice(0, 3) + ".").includes(citation.publicationMonth)
    ) {
      citation.publicationMonth = months
        .map((m) => m.slice(0, 3) + ".")
        .indexOf(citation.publicationMonth)
        .toString()
        .padStart(2, "0");
    }
    if (
      months.map((m) => m.slice(0, 4) + ".").includes(citation.publicationMonth)
    ) {
      citation.publicationMonth = months
        .map((m) => m.slice(0, 4) + ".")
        .indexOf(citation.publicationMonth)
        .toString()
        .padStart(2, "0");
    }
  }

  const apa = formatCitationAPA(citation);
  const mla = formatCitationMLA(citation);
  const chicago = formatCitationChicago(citation);

  return {
    apa: apa,
    mla: mla,
    chicago: chicago,
  };
}

function formatAuthorsAPA(authors) {
  if (!authors || authors.length === 0) {
    return "";
  }
  const formattedAuthors = authors.map((author) => {
    if (author.firstName) {
      // Existing logic when firstName is present
      const firstInitials = author.firstName
        .split(" ")
        .map((n) => n.charAt(0).toUpperCase() + ".")
        .join(" ");
      return `${author.lastName}, ${firstInitials}`;
    } else {
      // When only lastName is provided, treat it as the full name
      return author.lastName;
    }
  });
  // Handle the formatting of multiple authors as before
  if (formattedAuthors.length === 1) {
    return formattedAuthors[0];
  } else if (formattedAuthors.length === 2) {
    return `${formattedAuthors[0]} & ${formattedAuthors[1]}`;
  } else {
    const lastAuthor = formattedAuthors.pop();
    return `${formattedAuthors.join(", ")}, & ${lastAuthor}`;
  }
}

function formatDateAPA(citation) {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  if (citation.year) {
    let dateStr = `(${citation.year}`;
    if (citation.month) {
      dateStr += `, ${months[Number(citation.month) - 1]}`;
      if (citation.day) {
        dateStr += ` ${Number(citation.day)}`;
      }
    }
    dateStr += ").";
    return dateStr;
  } else {
    return "(n.d.).";
  }
}

function formatTitleAPA(title, subtitle) {
  if (!title && !subtitle) return "[No title].";
  let fullTitle = title || "";
  if (subtitle) {
    fullTitle += title ? ": " + subtitle : subtitle;
  }
  return `${fullTitle}.`;
}

function formatCitationAPA(citation) {
  let authors = formatAuthorsAPA(citation.authors);
  let date = formatDateAPA(citation);
  let title = formatTitleAPA(citation.title, citation.subtitle);
  const siteName = citation.siteName ? citation.siteName + "." : "";
  const url = citation.url ? citation.url : "";

  if (!authors) {
    // If no authors, title moves to author position
    authors = title || "[No title].";
    title = "";
  }

  if (!date) {
    date = "(n.d.).";
  }

  const citationParts = [authors, date, title, siteName, url];
  return citationParts.filter((part) => part).join(" ");
}

function formatAuthorsMLA(authors) {
  if (!authors || authors.length === 0) {
    return "";
  }
  if (authors.length === 1) {
    return formatSingleAuthorMLA(authors[0]);
  } else if (authors.length === 2) {
    const firstAuthor = formatSingleAuthorMLA(authors[0]);
    const secondAuthor = formatSingleAuthorMLA(authors[1]);
    return `${firstAuthor}, and ${secondAuthor}`;
  } else {
    const firstAuthor = formatSingleAuthorMLA(authors[0]);
    return `${firstAuthor}, et al.`;
  }
}

function formatSingleAuthorMLA(author) {
  if (author.firstName) {
    return `${author.lastName}, ${author.firstName}`;
  } else {
    // When only lastName is provided, treat it as the full name
    return author.lastName;
  }
}

function formatCitationMLA(citation) {
  let authors = formatAuthorsMLA(citation.authors);
  let title = citation.title
    ? `"${citation.title}${citation.subtitle ? ": " + citation.subtitle : ""}."`
    : '"[No title]."';
  const siteName = citation.siteName ? citation.siteName : "";
  const publisher = citation.publisher ? citation.publisher : "";
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const publicationYear = citation.publicationYear ? citation.publicationYear : "";
  const publicationMonth = months[Number(citation.publicationMonth) - 1]
    ? `${months[Number(citation.publicationMonth) - 1]}`
    : "";
  const publicationDay = Number(citation.publicationDay) ? `${Number(citation.publicationDay)}` : "";
  const publicationDate =
    publicationYear && publicationMonth && publicationDay
      ? `${publicationYear}, ${publicationMonth} ${publicationDay}`
      : "";
  const url = citation.url ? citation.url : "";
  const accessDate = citation.accessDate
    ? `Accessed ${citation.accessDate}.`
    : "";

  const citationParts = [
    authors ? authors + "." : "",
    title,
    siteName ? siteName + "," : "",
    publisher ? publisher + "," : "",
    publicationDate ? publicationDate + "," : "",
    url ? url + "." : "",
    accessDate,
  ];

  return citationParts.filter((part) => part).join(" ");
}

function formatAuthorsChicago(authors) {
  if (!authors || authors.length === 0) {
    return "";
  }
  const formattedAuthors = authors.map((author) => {
    if (author.firstName) {
      return `${author.lastName}, ${author.firstName}`;
    } else {
      // When only lastName is provided, treat it as the full name
      return author.lastName;
    }
  });
  if (formattedAuthors.length === 1) {
    return formattedAuthors[0];
  } else if (formattedAuthors.length <= 3) {
    const lastAuthor = formattedAuthors.pop();
    return `${formattedAuthors.join(", ")}, and ${lastAuthor}`;
  } else {
    return `${formattedAuthors[0]}, et al.`;
  }
}

function formatCitationChicago(citation) {
  let authors = formatAuthorsChicago(citation.authors);
  let title = citation.title
    ? `"${citation.title}${citation.subtitle ? ": " + citation.subtitle : ""}."`
    : '"[No title]."';
  const siteName = citation.siteName ? citation.siteName + "." : "";
  const publicationDate = citation.publicationDate
    ? citation.publicationDate + "."
    : "";
  const accessDate = citation.accessDate
    ? `Accessed ${citation.accessDate}.`
    : "";
  const url = citation.url ? citation.url : "";

  const citationParts = [
    authors ? authors + "." : "",
    title,
    siteName,
    publicationDate,
    accessDate,
    url,
  ];
  return citationParts.filter((part) => part).join(" ");
}

module.exports = {
  formatCitation,
  formatCitationAPA,
  formatCitationMLA,
  formatCitationChicago,
};
