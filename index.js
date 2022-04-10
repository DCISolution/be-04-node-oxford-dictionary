/**
 * index.js
 *
 * Queries (the free version of) the Oxford University Press
 * API and displays an error message or the definitions of the
 * given expression in the Console.
 *
 * Example:
 *
 * $ node index debug
 * ***************************
 *
 * Definitions of "debug", as provided by Oxford University
 * Press
 *
 * # Verb
 * 1. identify and remove errors from (computer hardware or
 *    software)
 * 2. detect and remove concealed microphones from (an area).
 * 3. remove insects from (something), especially with a
 *    pesticide.
 *
 * # Noun
 * 1. the process of identifying and removing errors from
 *    computer hardware or software
 *
 * ***************************
 *
 * NOTE
 * ————
 * Data from Oxford University Press may contain empty sections
 * so the code below contains some defensive coding.
 * (Example: "so")
 *
 * See the file structure.json for a trimmed schema of a typical
 * response.data object, or set.data.results.json for the
 * complete object returned for the expression "set".
 */


// Read the API key and id form your hidden .env file
// Get your own key and id here:
// https://developer.oxforddictionaries.com
require("dotenv").config();
const APP_KEY = process.env.APP_KEY;
const APP_ID = process.env.APP_ID;

// Read from the command line, allowing for multi-word
// expressions like "so far"
let expression = process.argv.slice(2).join(" ");

// The command line allows the # character: reserve this for
// comments
const commentIndex = expression.indexOf("#")
if (commentIndex > -1) {
  expression = expression.substring(0, commentIndex)
                         .trim()
}


// Create the query for the API
const axios = require("axios");
const config = {
  method: 'get',
  url: `https://od-api.oxforddictionaries.com/api/v2/entries/en/${expression}?fields=definitions`,
  headers: {
    APP_ID: APP_ID,
    APP_KEY: APP_KEY,
  }
}


/**
 * treatResponse tunnels in to each object in the response.data
 * array to find, for each object.lexicalEntries[]:
 * • lexicalCategory.text
 *   whose value will be a part of speech: Verb, Noun, Adjective
 * • entries[].senses[].definitions
 * All definitions for a particular part of speech are
 * collected in an array, even if they come from different
 * lexicalEntries.
 */
const treatResponse = ({ data }) => {
  const { metadata, results } = data

  // Iterate through each top-level object, sorting the definitions
  // from that object into the appropriate part-of-speech array
  const collection = results.reduce(treatTopLevelObject, {})
  // { "Verb": [<definition>, ...]
  // , "Noun": [<definition>, ...]
  // , ...
  // }

  // Convert this map of arrays into text
  const categories = Object.keys(collection) //.sort()
  let definitions = ""

  categories.forEach( category => {
    const data = collection[category]
    if (data && data.length) { // definitions array may be empty
      const catDefs = data.map(( definition, index )  => (
        `${index + 1}. ${definition}`
      ))
      definitions += `\n# ${category}\n${catDefs.join("\n")}\n`
    }
  })

  // Log output to console here
  console.log("***************************")
  console.log(`\nDefinitions of "${expression}", as provided by ${metadata.provider}`);
  console.log(definitions);
  console.log("***************************")
}


/**
 * In each object at the root of response.data, there is a 
 * key-value pair "lexicalEntries". The value is an array of
 * sub-objects. Definitions are read from these sub-objects.
 */
const treatTopLevelObject = (collector, topLevelObject) => {
  const { lexicalEntries } = topLevelObject

  return lexicalEntries.reduce(treatLexicalEntry, collector)
}


/**
 * Each sub-object in the lexicalEntries array contains a
 * "lexicalCategory" object like {"id": "verb", "text": "Verb"}
 * This identifies the part of speech. The sub-object also
 * contains an "entries" array containing objects which
 * describe one particular meaning of the expression.
 */
const treatLexicalEntry = ( collector, lexicalEntry ) => {
  const { entries, lexicalCategory } = lexicalEntry

  const partOfSpeech = lexicalCategory.text // "Verb"|"Noun"|...

  // Tunnel deeper to get the definitions
  let definitions = entries.map(treatEntry)
                           .flat()

  // Update the appropriate array in the collector object
  const current = collector[partOfSpeech] || []
  collector[partOfSpeech] = [...current, ...definitions]

  return collector
}


/**
 * An entry object contains a "senses" array of sub-objects,
 * each of which contains a "definitions" array of strings.
 * These are the definition strings that we want to collect.
 *
 * NOTE: Certain defective entries in the JSON object returned 
 * by Oxford University Press contain no "sense" array. This may
 * result in an empty definitions list being returned.
 */
const treatEntry = ( entry ) => {
  const { senses=[] } = entry // defensive coding

  const treatSense = ( array, sense ) => {
    return [...array, sense.definitions].flat()
  }

  return senses.reduce(treatSense, [])
}


/**
 * treatError may be called by
 * • The .catch() method of the axios promise
 *   if there is a problem with the API call
 * • By an error in the treatResponse() function and its helper
 *   functions. Such an error could be due to a mistaken
 *   assumption about the structure of the JSON data.
 */
 const treatError = (error) => {
  if ( error.response ) {
    // axios error
    const { response } = error
    const { status, statusText } = response

    switch (status) {
      case 404:
        console.log(`⚠\nERROR ${status}: "${expression}" ${statusText}⚠`)
        console.log("Please check your spelling\n⚠")
      break
      case 400:
      case 403:
        console.log(`⚠\nERROR ${status}: ${statusText}\nCheck the APP_KEY and APP_ID in your .env file.\n⚠`)
      break
      default:
        console.log(`⚠\nERROR ${status} for "${expression}": ${statusText}\n⚠`)
    }

  } else {
    switch (error.code) {
      case 'ERR_HTTP_INVALID_HEADER_VALUE':
        console.log(`⚠\nERROR: ${error.message}`)
        console.log
        ("Check that you have correctly created the .env file.")
        console.log("Get your own key and id here: https://developer.oxforddictionaries.com\n⚠")
      break
      default:
        // script error
        console.log(error);
    }
  }
}


// Query the API and wait for the results to arrive
axios(config)
  .then(treatResponse)
  .catch(treatError);
