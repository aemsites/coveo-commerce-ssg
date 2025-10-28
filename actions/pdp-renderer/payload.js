const getAllReviews = ({ productCode, applications = [], species = [], ratings = [], sortMode = 'NEWEST' }) =>
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

module.exports = { getAllReviews }
