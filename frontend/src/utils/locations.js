/**
 * CivicPulse Geographical Hierarchy Master Registry
 * Provides structured stateId, districtId, talukaId and names.
 */

export const GEOGRAPHIC_HIERARCHY = {
  maharashtra: {
    id: 'maharashtra',
    name: 'Maharashtra',
    districts: {
      mumbai: {
        id: 'mumbai',
        name: 'Mumbai',
        talukas: [
          { id: 'mumbai_city', name: 'Mumbai City' },
          { id: 'andheri', name: 'Andheri' },
          { id: 'kurla', name: 'Kurla' },
          { id: 'borivali', name: 'Borivali' }
        ]
      },
      pune: {
        id: 'pune',
        name: 'Pune',
        talukas: [
          { id: 'haveli', name: 'Haveli' },
          { id: 'pune_city', name: 'Pune City' },
          { id: 'khed', name: 'Khed' },
          { id: 'baramati', name: 'Baramati' },
          { id: 'maval', name: 'Maval' },
          { id: 'shirur', name: 'Shirur' }
        ]
      },
      thane: {
        id: 'thane',
        name: 'Thane',
        talukas: [
          { id: 'thane_city', name: 'Thane City' },
          { id: 'kalyan', name: 'Kalyan' },
          { id: 'bhiwandi', name: 'Bhiwandi' },
          { id: 'ulhasnagar', name: 'Ulhasnagar' }
        ]
      },
      nagpur: {
        id: 'nagpur',
        name: 'Nagpur',
        talukas: [
          { id: 'nagpur_urban', name: 'Nagpur Urban' },
          { id: 'nagpur_rural', name: 'Nagpur Rural' },
          { id: 'kamthi', name: 'Kamthi' },
          { id: 'umred', name: 'Umred' }
        ]
      },
      nashik: {
        id: 'nashik',
        name: 'Nashik',
        talukas: [
          { id: 'nashik_city', name: 'Nashik City' },
          { id: 'niphad', name: 'Niphad' },
          { id: 'sinnar', name: 'Sinnar' },
          { id: 'malegaon', name: 'Malegaon' }
        ]
      },
      aurangabad: {
        id: 'aurangabad',
        name: 'Chhatrapati Sambhajinagar (Aurangabad)',
        talukas: [
          { id: 'aurangabad_city', name: 'Aurangabad City' },
          { id: 'paithan', name: 'Paithan' },
          { id: 'gangapur', name: 'Gangapur' },
          { id: 'vaijapur', name: 'Vaijapur' }
        ]
      }
    }
  },
  gujarat: {
    id: 'gujarat',
    name: 'Gujarat',
    districts: {
      ahmedabad: {
        id: 'ahmedabad',
        name: 'Ahmedabad',
        talukas: [
          { id: 'ahmedabad_city', name: 'Ahmedabad City' },
          { id: 'daskroi', name: 'Daskroi' },
          { id: 'sanand', name: 'Sanand' },
          { id: 'dholka', name: 'Dholka' }
        ]
      },
      surat: {
        id: 'surat',
        name: 'Surat',
        talukas: [
          { id: 'surat_city', name: 'Surat City' },
          { id: 'chorasi', name: 'Chorasi' },
          { id: 'olpad', name: 'Olpad' },
          { id: 'bardoli', name: 'Bardoli' }
        ]
      },
      vadodara: {
        id: 'vadodara',
        name: 'Vadodara',
        talukas: [
          { id: 'vadodara_city', name: 'Vadodara City' },
          { id: 'vadodara_rural', name: 'Vadodara Rural' },
          { id: 'padra', name: 'Padra' },
          { id: 'dabhoi', name: 'Dabhoi' }
        ]
      },
      rajkot: {
        id: 'rajkot',
        name: 'Rajkot',
        talukas: [
          { id: 'rajkot_city', name: 'Rajkot City' },
          { id: 'gondal', name: 'Gondal' },
          { id: 'jetpur', name: 'Jetpur' },
          { id: 'morbi_road', name: 'Morbi Road' }
        ]
      }
    }
  },
  karnataka: {
    id: 'karnataka',
    name: 'Karnataka',
    districts: {
      bengaluru_urban: {
        id: 'bengaluru_urban',
        name: 'Bengaluru Urban',
        talukas: [
          { id: 'bengaluru_north', name: 'Bengaluru North' },
          { id: 'bengaluru_south', name: 'Bengaluru South' },
          { id: 'bengaluru_east', name: 'Bengaluru East' },
          { id: 'anekal', name: 'Anekal' }
        ]
      },
      mysuru: {
        id: 'mysuru',
        name: 'Mysuru',
        talukas: [
          { id: 'mysuru_city', name: 'Mysuru City' },
          { id: 'nanjangud', name: 'Nanjangud' },
          { id: 'hunsur', name: 'Hunsur' },
          { id: 't_narasipura', name: 'T. Narasipura' }
        ]
      },
      hubballi_dharwad: {
        id: 'hubballi_dharwad',
        name: 'Dharwad (Hubballi-Dharwad)',
        talukas: [
          { id: 'hubballi_urban', name: 'Hubballi Urban' },
          { id: 'dharwad_taluka', name: 'Dharwad' },
          { id: 'kalghatgi', name: 'Kalghatgi' },
          { id: 'navalgund', name: 'Navalgund' }
        ]
      }
    }
  },
  tamil_nadu: {
    id: 'tamil_nadu',
    name: 'Tamil Nadu',
    districts: {
      chennai: {
        id: 'chennai',
        name: 'Chennai',
        talukas: [
          { id: 'egmore', name: 'Egmore' },
          { id: 'guindy', name: 'Guindy' },
          { id: 'mylapore', name: 'Mylapore' },
          { id: 'tondiarpet', name: 'Tondiarpet' }
        ]
      },
      coimbatore: {
        id: 'coimbatore',
        name: 'Coimbatore',
        talukas: [
          { id: 'coimbatore_north', name: 'Coimbatore North' },
          { id: 'coimbatore_south', name: 'Coimbatore South' },
          { id: 'pollachi', name: 'Pollachi' },
          { id: 'sulur', name: 'Sulur' }
        ]
      }
    }
  },
  delhi: {
    id: 'delhi',
    name: 'Delhi (NCT)',
    districts: {
      central_delhi: {
        id: 'central_delhi',
        name: 'Central Delhi',
        talukas: [
          { id: 'civil_lines', name: 'Civil Lines' },
          { id: 'karol_bagh', name: 'Karol Bagh' },
          { id: 'kotwali', name: 'Kotwali' }
        ]
      },
      south_delhi: {
        id: 'south_delhi',
        name: 'South Delhi',
        talukas: [
          { id: 'hauz_khas', name: 'Hauz Khas' },
          { id: 'saket', name: 'Saket' },
          { id: 'mehrauli', name: 'Mehrauli' }
        ]
      },
      new_delhi: {
        id: 'new_delhi',
        name: 'New Delhi',
        talukas: [
          { id: 'chanakyapuri', name: 'Chanakyapuri' },
          { id: 'delhi_cantt', name: 'Delhi Cantonment' },
          { id: 'vasant_vihar', name: 'Vasant Vihar' }
        ]
      }
    }
  },
  uttar_pradesh: {
    id: 'uttar_pradesh',
    name: 'Uttar Pradesh',
    districts: {
      lucknow: {
        id: 'lucknow',
        name: 'Lucknow',
        talukas: [
          { id: 'lucknow_city', name: 'Lucknow City' },
          { id: 'bakshi_ka_talab', name: 'Bakshi Ka Talab' },
          { id: 'sarojini_nagar', name: 'Sarojini Nagar' },
          { id: 'mohanlalganj', name: 'Mohanlalganj' }
        ]
      },
      kanpur: {
        id: 'kanpur',
        name: 'Kanpur Nagar',
        talukas: [
          { id: 'kanpur_sadar', name: 'Kanpur Sadar' },
          { id: 'bilhaur', name: 'Bilhaur' },
          { id: 'ghatampur', name: 'Ghatampur' }
        ]
      },
      noida: {
        id: 'noida',
        name: 'Gautam Buddha Nagar (Noida)',
        talukas: [
          { id: 'noida_sadar', name: 'Noida Sadar' },
          { id: 'dadri', name: 'Dadri' },
          { id: 'jewar', name: 'Jewar' }
        ]
      }
    }
  },
  telangana: {
    id: 'telangana',
    name: 'Telangana',
    districts: {
      hyderabad: {
        id: 'hyderabad',
        name: 'Hyderabad',
        talukas: [
          { id: 'charminar', name: 'Charminar' },
          { id: 'khairatabad', name: 'Khairatabad' },
          { id: 'secunderabad', name: 'Secunderabad' },
          { id: 'serilingampally', name: 'Serilingampally' }
        ]
      },
      warangal: {
        id: 'warangal',
        name: 'Warangal',
        talukas: [
          { id: 'warangal_urban', name: 'Warangal Urban' },
          { id: 'kazipet', name: 'Kazipet' },
          { id: 'hanamkonda', name: 'Hanamkonda' }
        ]
      }
    }
  },
  west_bengal: {
    id: 'west_bengal',
    name: 'West Bengal',
    districts: {
      kolkata: {
        id: 'kolkata',
        name: 'Kolkata',
        talukas: [
          { id: 'kolkata_north', name: 'Kolkata North' },
          { id: 'kolkata_south', name: 'Kolkata South' },
          { id: 'kolkata_central', name: 'Kolkata Central' },
          { id: 'alipore', name: 'Alipore' }
        ]
      },
      howrah: {
        id: 'howrah',
        name: 'Howrah',
        talukas: [
          { id: 'howrah_sadar', name: 'Howrah Sadar' },
          { id: 'uluberia', name: 'Uluberia' },
          { id: 'bally', name: 'Bally' }
        ]
      }
    }
  }
}

// Flat lookup helpers
export function getAllStates() {
  return Object.values(GEOGRAPHIC_HIERARCHY).map((s) => ({
    id: s.id,
    name: s.name
  }))
}

export function getDistrictsForState(stateIdOrName) {
  if (!stateIdOrName) return []
  const clean = String(stateIdOrName).toLowerCase().trim().replace(/[\s\-_]/g, '')

  const stateObj = Object.values(GEOGRAPHIC_HIERARCHY).find(
    (s) => s.id.replace(/[\s\-_]/g, '') === clean || s.name.toLowerCase().replace(/[\s\-_]/g, '') === clean
  )

  if (!stateObj) return []
  return Object.values(stateObj.districts).map((d) => ({
    id: d.id,
    name: d.name
  }))
}

export function getTalukasForDistrict(stateIdOrName, districtIdOrName) {
  if (!stateIdOrName || !districtIdOrName) return []
  const cleanState = String(stateIdOrName).toLowerCase().trim().replace(/[\s\-_]/g, '')
  const cleanDist = String(districtIdOrName).toLowerCase().trim().replace(/[\s\-_]/g, '')

  const stateObj = Object.values(GEOGRAPHIC_HIERARCHY).find(
    (s) => s.id.replace(/[\s\-_]/g, '') === cleanState || s.name.toLowerCase().replace(/[\s\-_]/g, '') === cleanState
  )
  if (!stateObj) return []

  const distObj = Object.values(stateObj.districts).find(
    (d) => d.id.replace(/[\s\-_]/g, '') === cleanDist || d.name.toLowerCase().replace(/[\s\-_]/g, '') === cleanDist
  )
  if (!distObj) return []

  return distObj.talukas || []
}

/**
 * Backward compatibility helpers for legacy string-based states/districts
 */
export function resolveLocationMetadata({ state, district, taluka }) {
  const allStates = getAllStates()
  let resolvedState = allStates.find((s) => s.name.toLowerCase() === (state || '').toLowerCase() || s.id === state)
  if (!resolvedState) resolvedState = allStates[0]

  const districts = getDistrictsForState(resolvedState.id)
  let resolvedDist = districts.find((d) => d.name.toLowerCase() === (district || '').toLowerCase() || d.id === district)
  if (!resolvedDist) resolvedDist = districts[0] || { id: 'default_district', name: district || 'Main District' }

  const talukas = getTalukasForDistrict(resolvedState.id, resolvedDist.id)
  let resolvedTaluka = talukas.find((t) => t.name.toLowerCase() === (taluka || '').toLowerCase() || t.id === taluka)
  if (!resolvedTaluka) resolvedTaluka = talukas[0] || { id: 'default_taluka', name: taluka || 'Main Taluka' }

  return {
    stateId: resolvedState.id,
    stateName: resolvedState.name,
    districtId: resolvedDist.id,
    districtName: resolvedDist.name,
    talukaId: resolvedTaluka.id,
    talukaName: resolvedTaluka.name
  }
}
