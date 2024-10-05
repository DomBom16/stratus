function formatCitation(citation) {
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
  if (citation.year) {
    let dateStr = `(${citation.year}`;
    if (citation.month) {
      dateStr += `, ${citation.month}`;
      if (citation.day) {
        dateStr += ` ${citation.day}`;
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
  const publicationDate = citation.publicationDate
    ? citation.publicationDate
    : "n.d.";
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
