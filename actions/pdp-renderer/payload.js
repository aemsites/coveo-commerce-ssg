const allReviews = ({ productCode, applications = [], species = [], ratings = [], sortMode = 'NEWEST' }) =>
  JSON.stringify({
    query: `query Reviews {
    reviews(
      productCode: "${productCode}"
      sortBy: ${sortMode}
    ) {
      speciesName
      starRating {
        value
        interpretation
      }
      application {
        fullName
        shortName
      }
    }
    filteredReviews: reviews(
      productCode: "${productCode}"
      sortBy: ${sortMode}
      reviewsFilter:  {
        applicationShortName: ${applications.length > 0 ? JSON.stringify(applications) : null},
        speciesName: ${species.length > 0 ? JSON.stringify(species) : null},
        starRatingValue: ${ratings.length > 0 ? JSON.stringify(ratings) : null}
      }
    ) {
      speciesName
      starRating {
        value
        interpretation
      }
      application {
        fullName
        shortName
      }
      title
      datePublished
      id
      reviewId
      reviewImage {
        thumbnailPath
        fullPath
      }
      content {
        GroupOrder
        GroupName
        Pairs {
          name
          value
        }
      }
      reviewer {
        title
        firstName
        lastName
      }
      easeOfUse {
        value
        interpretation
      }
    }
    reviewsBreakdown(productCode: "${productCode}") {
      numberOfFiveStarReviews
      numberOfFourStarReviews
      numberOfThreeStarReviews
      numberOfTwoStarReviews
      numberOfOneStarReviews
      numberOfZeroStarReviews
    }
  }`,
  });

const singleReview = ({ indexId, reviewId }) =>
  JSON.stringify({
    query: `query ReviewDetails {
    reviewDetails(
      id: ${indexId},
      reviewId: "${reviewId}"
    ) {
      application {
        fullName
        __typename
      }
      content {
        GroupName
        GroupOrder
        Pairs {
          name
          value
          __typename
        }
        __typename
      }
      datePublished
      easeOfUse {
        value
        interpretation
        __typename
      }
      id
      reviewImage {
        fullPath
        thumbnailPath
        __typename
      }
      reviewer {
        firstName
        lastName
        title
        __typename
      }
      speciesName
      starRating {
        value
        interpretation
        __typename
      }
      title
      __typename
    }
  }`,
  });

module.exports = { allReviews, singleReview }
