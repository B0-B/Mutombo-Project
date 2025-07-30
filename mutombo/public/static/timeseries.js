/** 
 * Converts timeseries object into an aggregated hour array.
 * @param {object} timeseries timeseries object from e.g. stats.dns.blocks.timeseries
 * @param {number} totalHours Integer to set the total hour domain.
 * @returns {Promise<Array>} Array of dimension totalHours with hour count distribution.
 */
export async function aggregateTimeseriesArray (timeseries, totalHours=24) {
    
    // Init new timeseries array
    const timeseriesArray = new Array(totalHours).fill(0);

    // Current hour we are in
    const currentTimestamp = Date.now();
    
    // Reverse the timestamps in timeseries this will enhance runtime as we exploit the chronological 
    // nature of the timeseries and cutoff all timestamps with delta larger than totalHours.
    const reversedTimestamps = Object.keys(timeseries).reverse();

    for (let timestamp of reversedTimestamps) {
        const deltaHours = Math.floor((currentTimestamp - Number(timestamp)) / 3.6e+6);
        if (deltaHours > totalHours) break;
        timeseriesArray[totalHours-deltaHours-1]++ 
    }

    return timeseriesArray
}

export function timesArray (totalHours=24, format=true) {
    var arr = [];
    var nowMilliseconds = Date.now();
    for (let i = 0; i <= totalHours-1; i++) {
        const offsetMilliseconds = (totalHours-i)*3.6e6;
        const pastMilliseconds = nowMilliseconds-offsetMilliseconds;
        if (format) {
            const dateObj = new Date(pastMilliseconds);
            arr.push(dateObj.toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: '2-digit',
                hour: '2-digit'
            }));
        } else {
            arr.push(pastMilliseconds)
        }
    }
    return arr
}