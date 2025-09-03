import { Matrix3, Plane, Ray, Vector3 } from "three";

export function rad(degrees: number) {
    return degrees * Math.PI/180
}


/**
 * Compute the sun's position in horizontal coordinates, using the current date, time, latitude, and longitude.
 * @param day integer, 0 to 364
 * @param time number of minutes since UTC+0 00:00
 * @param latitude degrees
 * @param longitude degrees
 * @returns 
 */
export function calculateSunHorizontalCoordsFromUTC(day: number, time: number, latitude: number, longitude: number) {

    // 2023
    const D_utc = 8400.5 + day + time / 1440;

    const {rightAsc, declination} = calculateSunPositionInEquitorialCoords(D_utc)

    /** Terrestrial Time */
    const D_tt = D_utc_to_D_tt(D_utc)
    /** Obliquity of the ecliptic */
    const epsilon = calculateObliquityOfTheEcliptic(D_tt)
    /**Mean longitude of the sun */
    const L = calculateMeanLongitudeOfTheSun(D_tt)


    // compute hour angle
    // https://aa.usno.navy.mil/faq/GAST
    const D_utc_of_last_midnight = Math.trunc(D_utc + 0.5)- 0.5
    /** Hours since last midnight */
    const H = (D_utc - D_utc_of_last_midnight) * 24
    /**Centuries since noon on Jan 1st 2000 */
    const T = D_tt/36525;
    /** Greenwich apparent sidereal time (converted to hour angle) */
    const GMST = (6.697375 + 0.065707485828 * D_utc_of_last_midnight + 1.0027379*H + 0.0854103*T + 0.0000258 * Math.pow(T, 2)) * Math.PI/12
    const omega = rad(125.04) - rad(0.052954)*D_tt;
    const deltaPsi = (-0.000319 * Math.sin(omega) - 0.000024 * Math.sin(2 * L)) * Math.PI / 12
    const eqeq = deltaPsi * Math.cos(epsilon);
    const GAST = GMST + eqeq;

    const longRad = longitude * Math.PI / 180;
    const latRad = latitude * Math.PI / 180;

    /** local mean sidereal time */
    const LMST = GAST + longRad;
    /** hour angle */
    const h = LMST - rightAsc;

    return toHorizontalCoords(declination, h, latRad)

}

export function calculateSunHorizontalCoordsFromApparentSolarTime(day: number, time: number, latitude: number, longitude: number) {
   
    // approximate the declination of the sun at noon
    // strictly speaking the fn below should take a D_utc date/time. But this is max gonna be ~15 minutes off, and it's only the declination we care about anyway which doesn't change much in the course of a day
    const {declination} = calculateSunPositionInEquitorialCoords(8400.5/*0am on 1/1/2023*/ + time/1440 - longitude/360 + day)

    const hourAngle = (time - 12*60)/1440*Math.PI*2 // radians

    return toHorizontalCoords(declination, hourAngle, latitude * Math.PI / 180)

}

/**
 * 
 * @param day 0 to 364
 * @param time 0 to 1440, where 0 is 1 o'clock, 60 is 2 o'clock, etc 
 * @param latitude degrees
 * @param longitude degrees
 * @param options - (max|min)Declination - clamp declinations to these if specified
 */
export function calculateSunHorizontalCoordsFromBabylonianTime(day: number, time: number, latitude: number, longitude: number, options?:{maxDeclination?:number, minDeclination?:number}) {

    if (Math.abs(latitude) == 90) return null

    // https://www.bcgnomonics.com/types-of-hours
    // note: for the "sunrise" I am using the time when the center of the sun is first visible above the horizon (not accounting for atmospheric refraction)

    const clampBounds = {min:options?.minDeclination, max:options?.maxDeclination}

    // assume that the time between today's sunrise and tomorrow's is the mean (i.e. 24 hours in mst)
    // get the declination at 18:00 (roughly halfway between today's and tomorrow's sunrise)
    const sunriseEstDeclination = clamp(calculateSunPositionInEquitorialCoords(8401.25/*6pm on 1/1/2023*/ - longitude/360 + day).declination, clampBounds)
    const sunriseHourAngle = -calculateSunsetHourAngleNoNull(sunriseEstDeclination, latitude)

    const currentHourAngle = sunriseHourAngle + time/1440*2*Math.PI

    const currentDeclination = clamp(calculateSunPositionInEquitorialCoords(8401/*noon on 1/1/2023*/ - longitude/360 + day + currentHourAngle/(Math.PI*2)).declination, clampBounds)

    return toHorizontalCoords(currentDeclination, currentHourAngle, latitude * Math.PI / 180)
    

}

export function calculateSunHorizontalCoordsFromItalianTime(day: number, time: number, latitude: number, longitude: number, options?:{maxDeclination?:number, minDeclination?:number}) {

    if (Math.abs(latitude) == 90) return null
    const clampBounds = {min:options?.minDeclination, max:options?.maxDeclination}
    const sunriseEstDeclination = clamp(calculateSunPositionInEquitorialCoords(8400.75/*6am on 1/1/2023*/ - longitude/360 + day).declination, clampBounds)
    const sunsetHourAngle = calculateSunsetHourAngleNoNull(sunriseEstDeclination, latitude)
    const currentHourAngle = sunsetHourAngle - 2*Math.PI + time/1440*2*Math.PI
    const currentDeclination = clamp(calculateSunPositionInEquitorialCoords(8401/*noon on 1/1/2023*/ - longitude/360 + day + currentHourAngle/(Math.PI*2)).declination, clampBounds)

    return toHorizontalCoords(currentDeclination, currentHourAngle, latitude * Math.PI / 180)
}


/**
 * 
 * @param day 0 to 364
 * @param time 0 to 720, where 0 is 1 o'clock, 60 is 2 o'clock, etc 
 * @param latitude degrees
 * @param longitude degrees
 * @param options - (max|min)Declination - clamp declinations to these if specified
 */
export function calculateSunHorizontalCoordsFromSeasonalTime(day: number, time: number, latitude: number, longitude: number, options?:{maxDeclination?:number, minDeclination?:number}) {

    if (Math.abs(latitude) == 90) return null
    const clampBounds = {min:options?.minDeclination, max:options?.maxDeclination}
    const sunriseEstDeclination = clamp(calculateSunPositionInEquitorialCoords(8401/*noon on 1/1/2023*/ - longitude/360 + day).declination, clampBounds)
    const sunsetHourAngle = calculateSunsetHourAngleNoNull(sunriseEstDeclination, latitude)
    const sunriseHourAngle = -sunsetHourAngle
    const currentHourAngle = sunriseHourAngle + (sunsetHourAngle-sunriseHourAngle) * time/720
    const currentDeclination = clamp(calculateSunPositionInEquitorialCoords(8401/*noon on 1/1/2023*/ - longitude/360 + day + currentHourAngle/(Math.PI*2)).declination, clampBounds)

    return toHorizontalCoords(currentDeclination, currentHourAngle, latitude * Math.PI / 180)
}


/**
 * @param D_utc Universal Coordinated Time
 * @returns International Atomic Time
 */
export function D_utc_to_D_tai(D_utc:number) {
    // tai was 37 seconds ahead of UTC in 2023
    return D_utc + 37 / (24 * 60 * 60)
}

/**
 * @param D_tai International Atomic Time
 * @returns Terrestrial Time
 */
export function D_tai_to_D_tt(D_tai:number) {
    /**
     * Terrestrial Time (32.184 seconds ahead of TAI)
     * https://aa.usno.navy.mil/faq/TT
     */ 
    return D_tai + 32.184 / (24 * 60 * 60);
}

/**
 * @param D_utc Universal Coordinated Time
 * @returns Terrestrial Time
 */
export function D_utc_to_D_tt(D_utc:number) {
    return D_tai_to_D_tt(D_utc_to_D_tai(D_utc))
}

/**
 * (a.k.a epsilon)
 * @param D_tt Terrestrial Time
 * @returns ε in radians
 */
export function calculateObliquityOfTheEcliptic(D_tt: number) {
    return rad(23.4393) - rad(3.6e-7) * D_tt
}

/**
 * @param D_tt Terrestrial Time
 * @returns L in radians
 */
export function calculateMeanLongitudeOfTheSun(D_tt: number) {
    return (rad(280.459) + rad(0.98564736) * D_tt) % (2 * Math.PI)
}

/**
 * @param declination radians
 * @param hourAngle radians
 * @param latitude radians
 * @returns 
 */
export function toHorizontalCoords(declination:number, hourAngle:number, latitude:number) {
    // https://en.wikipedia.org/wiki/Astronomical_coordinate_systems
    const azimuth = -Math.atan2(Math.cos(declination) * Math.sin(hourAngle), -Math.sin(latitude) * Math.cos(declination) * Math.cos(hourAngle) + Math.cos(latitude) * Math.sin(declination));
    const altitude = Math.asin(Math.sin(latitude) * Math.sin(declination) + Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle));

    return { azimuth, altitude }
}

/**
 * @param D_utc Universal Coordinated Time
 * @returns equitorial coords in radians
 */
export function calculateSunPositionInEquitorialCoords(D_utc: number): {rightAsc:number, declination:number} {
     // using guide from here: https://en.wikipedia.org/wiki/Position_of_the_Sun
     // and https://aa.usno.navy.mil/faq/sun_approx

    /** Note about `D_utc`. Always within 1 second of `D_ut`, the observed value.
     * Leap seconds are added/subtracted to `D_utc` to compensate. 
     * `D_utc` is the (fractional) number of days since noon on January 1st, 2000.
     * Wikipedia page on position of the sun refers to this value as `n`.
     * D_utc IS FRACTIONAL here!
     * */

    /** International Atomic Time */
    const D_tai = D_utc_to_D_tai(D_utc)
    /** Terrestrial Time */ 
    const D_tt = D_tai_to_D_tt(D_tai)
    /** Mean longitude of the sun */
    const L = calculateMeanLongitudeOfTheSun(D_tt)
    /** Mean anomaly of the Sun */
    const g = (rad(357.529) + rad(0.98560028) * D_tt) % (2 * Math.PI);
    /**Geocentric apparent ecliptic longitude of the Sun (adjusted for aberration) */
    const lambda = L + rad(1.915) * Math.sin(g) + rad(0.020) * Math.sin(2 * g);
    /** Mean obliquity of the ecliptic */
    const epsilon = calculateObliquityOfTheEcliptic(D_tt)


    // convert to equitorial coords
    const rightAsc = Math.atan2(Math.cos(epsilon) * Math.sin(lambda), Math.cos(lambda));
    const declination = Math.asin(Math.sin(epsilon) * Math.sin(lambda));

    return {rightAsc, declination}
}

/**
 * To get the sun*rise* hour angle, just use the negative of this.
 * @param declination at noon. radians
 * @param latitude radians
 * @returns hour angle (ω_0) in radians
 */
export function calculateSunsetHourAngle(declination: number, latitude: number) {
    // https://en.wikipedia.org/wiki/Sunrise_equation

    /** Altitude angle - adjusts for atmospheric refraction and diameter of the sun.
     * Currently set to 0 to NOT account for the above effects.
     */
    const alpha = 0 /*rad(-0.833)*/
    const numerator = Math.sin(alpha)-Math.sin(latitude)*Math.sin(declination)
    const denominator = Math.cos(latitude)*Math.cos(declination)
    if (denominator == 0 || Math.abs(numerator) > Math.abs(denominator)) return null
    return Math.acos(numerator/denominator)

}


/**
 * calculateSunsetHourAngle could be null in extreme cases: sun could be above or below the horizon all day
 * if so, use the next day (or previous day) for which there is a sunrise/set.
 * i.e. if polar day, then the next sunset is at midnight (h=π)
 * and for polar night, the next sunset is at midday (h=0)
 * @param declination 
 * @param latitude 
 * @returns 
 */
export function calculateSunsetHourAngleNoNull(declination: number, latitude: number) {

    const latRad = latitude/180*Math.PI

    // const isPolarNight = Math.abs(latRad - sunriseEstDeclination) >= Math.PI
    // const isPolarDay = Math.abs(latRad + sunriseEstDeclination) >= Math.PI
    const substituteSunsetHourAngle = Math.abs(latRad + declination) > Math.abs(latRad - declination) ? Math.PI : 0
    return calculateSunsetHourAngle(declination, latRad) ?? substituteSunsetHourAngle


}


/**
 * Compute coordinates of the sun at distance `multiplyer` from the origin
 * @param azimuth 
 * @param altitude 
 * @param multiplyer 
 * @returns 
 */
export function horizontalToActualCoords(azimuth: number, altitude: number, multiplyer=15) {
    return {
        x: multiplyer * Math.sin(azimuth) * Math.cos(altitude),
        y: multiplyer * Math.sin(altitude),
        z: multiplyer * -Math.cos(azimuth) * Math.cos(altitude)
    }
}

/** Direction vector to the sun at an equinox (when the plane of the sun orbit is at 90° to the gnomon style)
 * 
 * Ignoring eliptical orbit/apparent time effects
 * @param timeAngle Midnight to midnight, 0 to 2π
 * @param latitude Latitude, in radians
*/
export function sunPosAtEquinox(timeAngle:number, latitude:number) {
    return new Vector3(Math.sin(timeAngle), -Math.cos(timeAngle) * Math.cos(latitude), -Math.cos(timeAngle) * Math.sin(latitude));
}


/**
 * Compute vector of the shadow path on the plate at a specific time
 * 
 * Be careful when the style is parallel to the plane at the moment the sun sets
 * 
 * @param timeAngle Midnight to midnight, 0 to 2π
 * @param latitude Latitude, in radians
 * @param plateNorm Normal vector to the plane of the plate
 * @returns
 */
export function calculateShadowDirection(timeAngle: number, latitude: number, plateNorm:Vector3) {


    /** Position of the sun at an equinox (when the plane of the sun orbit is at 90° to the gnomon style)
     * 
     * Ignoring eliptical orbit/apparent time effects
    */
    const sunPos = sunPosAtEquinox(timeAngle, latitude);

    /** unit vector of the gnomon style */
    const style = new Vector3(0, Math.sin(latitude), -Math.cos(latitude));


    // the direction of the shadow cast at this time can be found by the intersection of the planes:
    // 1, containing the sunPos and the style
    // 2, the plate
    // to do this, find the cross product of the normal vectors to both planes

    const norm1 = sunPos.clone().cross(style);
    const shadowDir = norm1.clone().cross(plateNorm);

    return shadowDir;

}

/**
 * Critical sun declination boundary at which a polar day occurs
 * @param latitude degrees
 * @returns degrees
 */
export function calculatePolarDayDeclination(latitude: number) {
    if (latitude >= 0)
        return 90 - latitude /*- 0.833*/
    else {
        return -90 - latitude /*- 0.833*/
    }
}


/**
 * Convert time to string.
 * @param time Minutes from midnight.
 * @returns 
 */
export function timeToString(time: number) {
    // const timeObj = new Date();
    // timeObj.setHours(Math.floor(time / 60));
    // timeObj.setMinutes(time % 60)
    // return timeObj.toLocaleTimeString(undefined, { hour: "numeric", minute: "numeric" })

    const hours = Math.floor((((time / 60)%24)+24)%24).toString().padStart(2, "0");
    const minutes = Math.floor(((time % 60)+60) % 60).toString().padStart(2, "0")

    return `${hours}:${minutes}`
}

/**
 * Parses string times in format `xx:xx`
 * @param str 
 * @returns The time, or NaN if could not be parsed.
 */
export function stringToTime(str: string) {
    const result = str.match(/^\s*([0-9]+)(?::([0-9]*))?\s*$/);
    if (!result) return NaN;

    const hours = Number.parseInt(result[1]);
    if (hours < 0 || hours > 23) return NaN;

    let minutes = 0;
    if (result[2] && result[2] != "") {
        minutes = Number.parseInt(result[2]);
        if (minutes < 0 || minutes > 59) return NaN;
    }

    return hours*60 + minutes;

}

/**
 * Convert day to string
 * @param day Days since 1st January in a non-leap year (0 to 364)
 * @returns 
 */
export function dateToString(day: number) {
    // add date to an arbitrary non-leap year
    const dateObj = new Date(Date.parse("2001") + day * 24 * 60 * 60 * 1000);
    return dateObj.toLocaleDateString("en", { month: "long", day: 'numeric' })
}

/**
 * Convert time zone to string
 * @param timeZone Minutes difference from UTC
 * @returns 
 */
export function timeZoneToString(timeZone:number) {

    const symbol = timeZone > 0 ? "+"
        : timeZone < 0 ? "-"
            : "±";
    const hours = Math.abs(Math.trunc(timeZone / 60));
    const mins = Math.abs(timeZone % 60);
    let result = symbol + hours.toString();
    if (mins != 0) result += ":" + mins.toString();
    return result;

}

/**
 * Intersect an infinite line with a plane
 * @param plane The plane 
 * @param linePoint A point on the line 
 * @param lineDirection A vector in the direction of the line
 * @returns The point of intersection, if it exists
 */
export function infiniteLineIntersectWithPlaneWithDir(plane: Plane, linePoint: Vector3, lineDirection: Vector3) {

    // rays are only infinite in 1 direction. Need 2 rays, try both
    const ray = new Ray(linePoint, lineDirection);
    let intersection = ray.intersectPlane(plane, new Vector3())
    if (intersection) return {dir: 1, point: intersection}
    
    const ray2 = new Ray(linePoint, lineDirection.clone().multiplyScalar(-1));
    intersection = ray2.intersectPlane(plane, new Vector3())
    if (intersection) return {dir: -1, point:intersection};

    return null;
}

/**
 * Intersect an infinite line with a plane
 * @param plane The plane 
 * @param linePoint A point on the line 
 * @param lineDirection A vector in the direction of the line
 * @returns The point of intersection, if it exists, and the direction from the line point traveled.
 */
export function infiniteLineIntersectWithPlane(plane: Plane, linePoint: Vector3, lineDirection: Vector3) {

    const ptWithDir = infiniteLineIntersectWithPlaneWithDir(plane, linePoint, lineDirection);
    if (ptWithDir) return ptWithDir.point;
    return null;
}

/**
 * intersections with the sphere and r = linePoint + λ * lineDirection
 * find values of λ, if they exist
 * @param sphereOrigin 
 * @param sphereRadius 
 * @param linePoint 
 * @param lineDirection 
 */
export function infiniteLineIntersectWithSphereParameters(sphereOrigin: Vector3, sphereRadius: number, linePoint: Vector3, lineDirection: Vector3) {

    // intersections with the sphere and r = linePoint + λ * lineDirection
    // find values of λ
    const c = sphereOrigin.distanceToSquared(linePoint) - Math.pow(sphereRadius, 2);
    const b = sphereOrigin.clone().sub(linePoint).multiply(lineDirection).dot(new Vector3(1, 1, 1)) * -2;
    const a = Math.pow(lineDirection.length(), 2);

    const discriminant = Math.pow(b, 2) - 4 * a * c;
    if (discriminant < 0) return [];

    return [
        (-b - Math.sqrt(discriminant)) / (2 * a),
        (-b + Math.sqrt(discriminant)) / (2 * a)
    ]
 
}


export function infiniteLineIntersectWithSphere(sphereOrigin: Vector3, sphereRadius: number, linePoint: Vector3, lineDirection: Vector3) {

    const roots = infiniteLineIntersectWithSphereParameters(sphereOrigin, sphereRadius, linePoint, lineDirection) ;
    if (roots.length == 0) return null;

    else return [
        lineDirection.clone().multiplyScalar(roots[0]).add(linePoint),
        lineDirection.clone().multiplyScalar(roots[1]).add(linePoint),
    ]

}

export function longitudeToTimeZone(longitude:number) {
    return Math.round(longitude / 360 * 24) * 60;
}


/**
 * Taken from https://stackoverflow.com/a/62141424.
 * 
 * Intersecrion point of 3 planes.
 * @returns 
 */
export function vertIntersectPlanes(p1: Plane, p2: Plane, p3: Plane) {
    const n1 = p1.normal, n2 = p2.normal, n3 = p3.normal;
    const x1 = p1.coplanarPoint(new Vector3());
    const x2 = p2.coplanarPoint(new Vector3());
    const x3 = p3.coplanarPoint(new Vector3());
    const f1 = new Vector3().crossVectors(n2, n3).multiplyScalar(x1.dot(n1));
    const f2 = new Vector3().crossVectors(n3, n1).multiplyScalar(x2.dot(n2));
    const f3 = new Vector3().crossVectors(n1, n2).multiplyScalar(x3.dot(n3));
    const det = new Matrix3().set(n1.x, n1.y, n1.z, n2.x, n2.y, n2.z, n3.x, n3.y, n3.z).determinant();
    if (det == 0) return null;
    const vectorSum = new Vector3().add(f1).add(f2).add(f3);
    const planeIntersection = new Vector3(vectorSum.x / det, vectorSum.y / det, vectorSum.z / det);
    return planeIntersection;
}


export function nonNullSequence<X>(arr: (X | null)[]): X[] {

    // if all nulls just return empty list
    if (arr.filter(x => x != null).length == 0) {
        return []
    }

    const seq = []

    const firstNullLoc = arr.indexOf(null)
    if (firstNullLoc == -1/* there are no nulls */) {
        return [...arr] as X[]
    }

    // collect the non-null elements into an array, dealing with wrap-around too
    for (let j = firstNullLoc; j < firstNullLoc + arr.length; j++) {
        const el = arr[j % arr.length]
        if (!el) {
            // null. If the seq is non-empty then we are at the end
            if (seq.length != 0) {
                break
            }
        } else {
            seq.push(el)
        }
    }

    return seq
}

export function padWithRepeatedLastElement<X>(arr: X[], length: number) {
    const numToPad = length - arr.length;
    const lastValue = arr[arr.length - 1]
    for (let k = 0; k < numToPad; k++) {
        arr.push(lastValue)
    }
}

/**
 * there may be nulls in the hour plot.
 * eg it may look like this:
 * [null null null null Vector3 Vector3 Vector3 null null ...]
 * collect the part of the list that is non null.
 * have to keep the number of points in the line constant otherwise cientos complains.
 * make the line 1 longer than the number of points, so they can be made closed if needed.
 * if the non-null line is shorter than needed, pad with the last value of the array.
 */
export function extractCloseAndPadSequence<X>(arr: (X|null)[], length:number, placeholder: X, dontClose?:boolean) : X[] {

    const line = nonNullSequence(arr)


    if (line.length == 0) {
        // make an "empty" line where all points are the same - rendering it invisible
        line.push(placeholder)
    } else if (line.length == length - 1) {
        // make it closed
        if (!dontClose) line.push(line[0])
    }

    padWithRepeatedLastElement(line, length)

    // testing, check that the line is straight

    return line
}

export function clamp(val: number, bounds:{min?:number, max?:number}) {
    if (bounds.min && val < bounds.min) val = bounds.min
    if (bounds.max && val > bounds.max) val = bounds.max
    return val
}

export function randomColor() {
    let col = "#"
    for (let i = 0; i < 6; i++)  {
        col += "0123456789abcdef".charAt(Math.floor(Math.random() * 16))
    }
    return col
}

// sometimes switch statements will cause ts errors despite all cases being covered.
// use this function for detecting when a case is not covered - place after switch.
// eslint-disable-next-line
export function assertUnreachable(x: never) : never {
    throw new Error("Didn't expect to get here");
}