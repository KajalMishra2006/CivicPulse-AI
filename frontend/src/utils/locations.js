/**
 * CivicPulse Geographical Hierarchy Master Registry
 * Full support for all 11 BRICS Member Countries:
 * Brazil, Russia, India, China, South Africa, Saudi Arabia, Egypt, United Arab Emirates, Ethiopia, Indonesia, Iran.
 */

export const BRICS_COUNTRIES = [
  { id: 'brazil', name: 'Brazil' },
  { id: 'russia', name: 'Russia' },
  { id: 'india', name: 'India' },
  { id: 'china', name: 'China' },
  { id: 'south_africa', name: 'South Africa' },
  { id: 'saudi_arabia', name: 'Saudi Arabia' },
  { id: 'egypt', name: 'Egypt' },
  { id: 'united_arab_emirates', name: 'United Arab Emirates' },
  { id: 'ethiopia', name: 'Ethiopia' },
  { id: 'indonesia', name: 'Indonesia' },
  { id: 'iran', name: 'Iran' }
]

export const BRICS_LOCATION_REGISTRY = {
  brazil: {
    id: 'brazil',
    name: 'Brazil',
    level1Label: 'State *',
    level1Placeholder: 'Select State',
    level2Label: 'Municipality *',
    level2Placeholder: 'Select Municipality',
    hasLevel3: false,
    localAreaLabel: 'Local Area *',
    localAreaPlaceholder: 'Enter your local area / neighborhood',
    regions: {
      sao_paulo: {
        id: 'sao_paulo',
        name: 'São Paulo',
        districts: [
          { id: 'sao_paulo_city', name: 'São Paulo (Capital)' },
          { id: 'campinas', name: 'Campinas' },
          { id: 'guarulhos', name: 'Guarulhos' },
          { id: 'sao_bernardo', name: 'São Bernardo do Campo' },
          { id: 'santo_andre', name: 'Santo André' },
          { id: 'osasco', name: 'Osasco' },
          { id: 'santos', name: 'Santos' },
          { id: 'ribeirao_preto', name: 'Ribeirão Preto' },
          { id: 'sao_jose_campos', name: 'São José dos Campos' },
          { id: 'sorocaba', name: 'Sorocaba' }
        ]
      },
      rio_de_janeiro: {
        id: 'rio_de_janeiro',
        name: 'Rio de Janeiro',
        districts: [
          { id: 'rio_city', name: 'Rio de Janeiro (Capital)' },
          { id: 'niteroi', name: 'Niterói' },
          { id: 'duque_de_caxias', name: 'Duque de Caxias' },
          { id: 'sao_goncalo', name: 'São Gonçalo' },
          { id: 'nova_iguacu', name: 'Nova Iguaçu' },
          { id: 'petropolis', name: 'Petrópolis' },
          { id: 'campos_goytacazes', name: 'Campos dos Goytacazes' }
        ]
      },
      minas_gerais: {
        id: 'minas_gerais',
        name: 'Minas Gerais',
        districts: [
          { id: 'belo_horizonte', name: 'Belo Horizonte' },
          { id: 'uberlandia', name: 'Uberlândia' },
          { id: 'contagem', name: 'Contagem' },
          { id: 'juiz_de_fora', name: 'Juiz de Fora' },
          { id: 'betim', name: 'Betim' },
          { id: 'montes_claros', name: 'Montes Claros' }
        ]
      },
      bahia: {
        id: 'bahia',
        name: 'Bahia',
        districts: [
          { id: 'salvador', name: 'Salvador' },
          { id: 'feira_de_santana', name: 'Feira de Santana' },
          { id: 'vitoria_da_conquista', name: 'Vitória da Conquista' },
          { id: 'camacari', name: 'Camaçari' },
          { id: 'juazeiro', name: 'Juazeiro' }
        ]
      },
      parana: {
        id: 'parana',
        name: 'Paraná',
        districts: [
          { id: 'curitiba', name: 'Curitiba' },
          { id: 'londrina', name: 'Londrina' },
          { id: 'maringa', name: 'Maringá' },
          { id: 'ponta_grossa', name: 'Ponta Grossa' },
          { id: 'foz_do_iguacu', name: 'Foz do Iguaçu' }
        ]
      },
      rio_grande_do_sul: {
        id: 'rio_grande_do_sul',
        name: 'Rio Grande do Sul',
        districts: [
          { id: 'porto_alegre', name: 'Porto Alegre' },
          { id: 'caxias_do_sul', name: 'Caxias do Sul' },
          { id: 'canoas', name: 'Canoas' },
          { id: 'pelotas', name: 'Pelotas' },
          { id: 'santa_maria', name: 'Santa Maria' }
        ]
      },
      distrito_federal: {
        id: 'distrito_federal',
        name: 'Distrito Federal',
        districts: [
          { id: 'brasilia', name: 'Brasília (Plano Piloto)' },
          { id: 'taguatinga', name: 'Taguatinga' },
          { id: 'ceilandia', name: 'Ceilândia' },
          { id: 'aguas_claras', name: 'Águas Claras' }
        ]
      }
    }
  },

  russia: {
    id: 'russia',
    name: 'Russia',
    level1Label: 'Federal Subject *',
    level1Placeholder: 'Select Federal Subject',
    level2Label: 'District / City *',
    level2Placeholder: 'Select District / City',
    hasLevel3: false,
    localAreaLabel: 'Local Area *',
    localAreaPlaceholder: 'Enter your local area / neighborhood',
    regions: {
      moscow: {
        id: 'moscow',
        name: 'Moscow (Federal City)',
        districts: [
          { id: 'central_okrug', name: 'Central Administrative Okrug' },
          { id: 'northern_okrug', name: 'Northern Administrative Okrug' },
          { id: 'north_eastern_okrug', name: 'North-Eastern Administrative Okrug' },
          { id: 'eastern_okrug', name: 'Eastern Administrative Okrug' },
          { id: 'south_eastern_okrug', name: 'South-Eastern Administrative Okrug' },
          { id: 'southern_okrug', name: 'Southern Administrative Okrug' },
          { id: 'south_western_okrug', name: 'South-Western Administrative Okrug' },
          { id: 'western_okrug', name: 'Western Administrative Okrug' },
          { id: 'north_western_okrug', name: 'North-Western Administrative Okrug' },
          { id: 'zelenograd', name: 'Zelenograd Okrug' }
        ]
      },
      saint_petersburg: {
        id: 'saint_petersburg',
        name: 'Saint Petersburg (Federal City)',
        districts: [
          { id: 'tsentralny', name: 'Tsentralny District' },
          { id: 'admiralteysky', name: 'Admiralteysky District' },
          { id: 'vasileostrovsky', name: 'Vasileostrovsky District' },
          { id: 'petrogradsky', name: 'Petrogradsky District' },
          { id: 'primorsky', name: 'Primorsky District' },
          { id: 'moskovsky_spb', name: 'Moskovsky District' },
          { id: 'kalininsky', name: 'Kalininsky District' }
        ]
      },
      moscow_oblast: {
        id: 'moscow_oblast',
        name: 'Moscow Oblast',
        districts: [
          { id: 'balashikha', name: 'Balashikha' },
          { id: 'podolsk', name: 'Podolsk' },
          { id: 'khimki', name: 'Khimki' },
          { id: 'mytishchi', name: 'Mytishchi' },
          { id: 'korolyov', name: 'Korolyov' },
          { id: 'krasnogorsk', name: 'Krasnogorsk' }
        ]
      },
      krasnodar_krai: {
        id: 'krasnodar_krai',
        name: 'Krasnodar Krai',
        districts: [
          { id: 'krasnodar_city', name: 'Krasnodar' },
          { id: 'sochi', name: 'Sochi' },
          { id: 'novorossiysk', name: 'Novorossiysk' },
          { id: 'anapa', name: 'Anapa' }
        ]
      },
      tatarstan: {
        id: 'tatarstan',
        name: 'Republic of Tatarstan',
        districts: [
          { id: 'kazan', name: 'Kazan' },
          { id: 'naberezhnye_chelny', name: 'Naberezhnye Chelny' },
          { id: 'nizhnekamsk', name: 'Nizhnekamsk' },
          { id: 'almetyevsk', name: 'Almetyevsk' }
        ]
      },
      sverdlovsk_oblast: {
        id: 'sverdlovsk_oblast',
        name: 'Sverdlovsk Oblast',
        districts: [
          { id: 'yekaterinburg', name: 'Yekaterinburg' },
          { id: 'nizhny_tagil', name: 'Nizhny Tagil' },
          { id: 'kamensk_uralsky', name: 'Kamensk-Uralsky' }
        ]
      },
      novosibirsk_oblast: {
        id: 'novosibirsk_oblast',
        name: 'Novosibirsk Oblast',
        districts: [
          { id: 'novosibirsk_city', name: 'Novosibirsk' },
          { id: 'berdsk', name: 'Berdsk' },
          { id: 'iskitim', name: 'Iskitim' }
        ]
      }
    }
  },

  india: {
    id: 'india',
    name: 'India',
    level1Label: 'State / Union Territory *',
    level1Placeholder: 'Select State / Union Territory',
    level2Label: 'District *',
    level2Placeholder: 'Select District',
    hasLevel3: true,
    level3Label: 'Tehsil / Taluka',
    level3Placeholder: 'Select Tehsil / Taluka',
    localAreaLabel: 'Local Area / Ward *',
    localAreaPlaceholder: 'Enter your local area / neighborhood',
    regions: {
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
  },

  china: {
    id: 'china',
    name: 'China',
    level1Label: 'Province / Region *',
    level1Placeholder: 'Select Province / Region',
    level2Label: 'Prefecture-level Division *',
    level2Placeholder: 'Select Prefecture-level Division',
    hasLevel3: false,
    localAreaLabel: 'Local Area *',
    localAreaPlaceholder: 'Enter your local area / neighborhood',
    regions: {
      beijing: {
        id: 'beijing',
        name: 'Beijing Municipality',
        districts: [
          { id: 'dongcheng', name: 'Dongcheng District' },
          { id: 'xicheng', name: 'Xicheng District' },
          { id: 'chaoyang', name: 'Chaoyang District' },
          { id: 'haidian', name: 'Haidian District' },
          { id: 'fengtai', name: 'Fengtai District' },
          { id: 'tongzhou', name: 'Tongzhou District' }
        ]
      },
      shanghai: {
        id: 'shanghai',
        name: 'Shanghai Municipality',
        districts: [
          { id: 'huangpu', name: 'Huangpu District' },
          { id: 'xuhui', name: 'Xuhui District' },
          { id: 'changning', name: 'Changning District' },
          { id: 'jingan', name: "Jing'an District" },
          { id: 'pudong', name: 'Pudong New Area' },
          { id: 'minhang', name: 'Minhang District' }
        ]
      },
      guangdong: {
        id: 'guangdong',
        name: 'Guangdong Province',
        districts: [
          { id: 'guangzhou', name: 'Guangzhou' },
          { id: 'shenzhen', name: 'Shenzhen' },
          { id: 'dongguan', name: 'Dongguan' },
          { id: 'foshan', name: 'Foshan' },
          { id: 'zhuhai', name: 'Zhuhai' },
          { id: 'huizhou', name: 'Huizhou' }
        ]
      },
      zhejiang: {
        id: 'zhejiang',
        name: 'Zhejiang Province',
        districts: [
          { id: 'hangzhou', name: 'Hangzhou' },
          { id: 'ningbo', name: 'Ningbo' },
          { id: 'wenzhou', name: 'Wenzhou' },
          { id: 'jiaxing', name: 'Jiaxing' }
        ]
      },
      jiangsu: {
        id: 'jiangsu',
        name: 'Jiangsu Province',
        districts: [
          { id: 'nanjing', name: 'Nanjing' },
          { id: 'suzhou', name: 'Suzhou' },
          { id: 'wuxi', name: 'Wuxi' },
          { id: 'changzhou', name: 'Changzhou' }
        ]
      },
      sichuan: {
        id: 'sichuan',
        name: 'Sichuan Province',
        districts: [
          { id: 'chengdu', name: 'Chengdu' },
          { id: 'mianyang', name: 'Mianyang' },
          { id: 'nanchong', name: 'Nanchong' },
          { id: 'yibin', name: 'Yibin' }
        ]
      }
    }
  },

  south_africa: {
    id: 'south_africa',
    name: 'South Africa',
    level1Label: 'Province *',
    level1Placeholder: 'Select Province',
    level2Label: 'Municipality *',
    level2Placeholder: 'Select Municipality',
    hasLevel3: false,
    localAreaLabel: 'Local Area *',
    localAreaPlaceholder: 'Enter your local area / neighborhood',
    regions: {
      gauteng: {
        id: 'gauteng',
        name: 'Gauteng',
        districts: [
          { id: 'johannesburg', name: 'City of Johannesburg' },
          { id: 'tshwane', name: 'City of Tshwane (Pretoria)' },
          { id: 'ekurhuleni', name: 'City of Ekurhuleni' },
          { id: 'sedibeng', name: 'Sedibeng District Municipality' },
          { id: 'west_rand', name: 'West Rand District Municipality' }
        ]
      },
      western_cape: {
        id: 'western_cape',
        name: 'Western Cape',
        districts: [
          { id: 'cape_town', name: 'City of Cape Town' },
          { id: 'cape_winelands', name: 'Cape Winelands District' },
          { id: 'garden_route', name: 'Garden Route District' },
          { id: 'overberg', name: 'Overberg District' },
          { id: 'west_coast', name: 'West Coast District' }
        ]
      },
      kwazulu_natal: {
        id: 'kwazulu_natal',
        name: 'KwaZulu-Natal',
        districts: [
          { id: 'ethekwini', name: 'eThekwini Metropolitan (Durban)' },
          { id: 'umgungundlovu', name: 'uMgungundlovu (Pietermaritzburg)' },
          { id: 'king_cetshwayo', name: 'King Cetshwayo District' },
          { id: 'ilembe', name: 'iLembe District' }
        ]
      },
      eastern_cape: {
        id: 'eastern_cape',
        name: 'Eastern Cape',
        districts: [
          { id: 'nelson_mandela_bay', name: 'Nelson Mandela Bay (Gqeberha)' },
          { id: 'buffalo_city', name: 'Buffalo City (East London)' },
          { id: 'sarah_baartman', name: 'Sarah Baartman District' }
        ]
      },
      free_state: {
        id: 'free_state',
        name: 'Free State',
        districts: [
          { id: 'mangaung', name: 'Mangaung Metropolitan (Bloemfontein)' },
          { id: 'fezile_dabi', name: 'Fezile Dabi District' },
          { id: 'thabo_mofutsanyana', name: 'Thabo Mofutsanyana District' }
        ]
      }
    }
  },

  saudi_arabia: {
    id: 'saudi_arabia',
    name: 'Saudi Arabia',
    level1Label: 'Region *',
    level1Placeholder: 'Select Region',
    level2Label: 'Governorate / City *',
    level2Placeholder: 'Select Governorate / City',
    hasLevel3: false,
    localAreaLabel: 'Local Area *',
    localAreaPlaceholder: 'Enter your local area / neighborhood',
    regions: {
      riyadh_region: {
        id: 'riyadh_region',
        name: 'Riyadh Region',
        districts: [
          { id: 'riyadh_city', name: 'Riyadh City' },
          { id: 'al_kharj', name: 'Al-Kharj' },
          { id: 'ad_diriyah', name: 'Ad-Diriyah' },
          { id: 'al_majmaah', name: "Al-Majma'ah" },
          { id: 'al_dawadmi', name: 'Al-Dawadmi' }
        ]
      },
      makkah_region: {
        id: 'makkah_region',
        name: 'Makkah Region',
        districts: [
          { id: 'jeddah', name: 'Jeddah' },
          { id: 'mecca_city', name: 'Mecca City' },
          { id: 'taif', name: 'Taif' },
          { id: 'rabigh', name: 'Rabigh' },
          { id: 'al_qunfudhah', name: 'Al-Qunfudhah' }
        ]
      },
      eastern_province: {
        id: 'eastern_province',
        name: 'Eastern Province',
        districts: [
          { id: 'dammam', name: 'Dammam' },
          { id: 'al_khobar', name: 'Al-Khobar' },
          { id: 'dhahran', name: 'Dhahran' },
          { id: 'jubail', name: 'Jubail' },
          { id: 'al_ahsa', name: 'Al-Ahsa' },
          { id: 'qatif', name: 'Qatif' }
        ]
      },
      madinah_region: {
        id: 'madinah_region',
        name: 'Madinah Region',
        districts: [
          { id: 'medina_city', name: 'Medina City' },
          { id: 'yanbu', name: 'Yanbu' },
          { id: 'al_ula', name: "Al-'Ula" }
        ]
      },
      asir_region: {
        id: 'asir_region',
        name: 'Asir Region',
        districts: [
          { id: 'abha', name: 'Abha' },
          { id: 'khamis_mushait', name: 'Khamis Mushait' }
        ]
      }
    }
  },

  egypt: {
    id: 'egypt',
    name: 'Egypt',
    level1Label: 'Governorate *',
    level1Placeholder: 'Select Governorate',
    level2Label: 'City / Markaz *',
    level2Placeholder: 'Select City / Markaz',
    hasLevel3: false,
    localAreaLabel: 'Local Area *',
    localAreaPlaceholder: 'Enter your local area / neighborhood',
    regions: {
      cairo: {
        id: 'cairo',
        name: 'Cairo Governorate',
        districts: [
          { id: 'nasr_city', name: 'Nasr City' },
          { id: 'heliopolis', name: 'Heliopolis' },
          { id: 'maadi', name: 'Maadi' },
          { id: 'zamalek', name: 'Zamalek' },
          { id: 'new_cairo', name: 'New Cairo' },
          { id: 'shubra_cairo', name: 'Shubra' },
          { id: 'downtown_cairo', name: 'Downtown Cairo' },
          { id: 'helwan', name: 'Helwan' }
        ]
      },
      alexandria: {
        id: 'alexandria',
        name: 'Alexandria Governorate',
        districts: [
          { id: 'montaza', name: 'Montaza District' },
          { id: 'sharq_alex', name: 'Sharq (East) District' },
          { id: 'wust_alex', name: 'Wust (Middle) District' },
          { id: 'gomrok', name: 'Gomrok' },
          { id: 'borg_el_arab', name: 'Borg El Arab' }
        ]
      },
      giza: {
        id: 'giza',
        name: 'Giza Governorate',
        districts: [
          { id: 'dokki', name: 'Dokki' },
          { id: 'agouza', name: 'Agouza' },
          { id: 'october_city', name: '6th of October City' },
          { id: 'sheikh_zayed', name: 'Sheikh Zayed City' },
          { id: 'al_haram', name: 'Al-Haram' },
          { id: 'imbaba', name: 'Imbaba' }
        ]
      },
      qalyubia: {
        id: 'qalyubia',
        name: 'Qalyubia Governorate',
        districts: [
          { id: 'banha', name: 'Banha' },
          { id: 'shubra_el_kheima', name: 'Shubra El Kheima' },
          { id: 'qalyub', name: 'Qalyub' }
        ]
      },
      sharqia: {
        id: 'sharqia',
        name: 'Sharqia Governorate',
        districts: [
          { id: 'zagazig', name: 'Zagazig' },
          { id: 'tenth_ramadan', name: '10th of Ramadan City' },
          { id: 'bilbeis', name: 'Bilbeis' }
        ]
      },
      port_said: {
        id: 'port_said',
        name: 'Port Said Governorate',
        districts: [
          { id: 'port_said_city', name: 'Port Said City' },
          { id: 'port_fouad', name: 'Port Fouad' }
        ]
      }
    }
  },

  united_arab_emirates: {
    id: 'united_arab_emirates',
    name: 'United Arab Emirates',
    level1Label: 'Emirate *',
    level1Placeholder: 'Select Emirate',
    level2Label: 'City / Municipality *',
    level2Placeholder: 'Select City / Municipality',
    hasLevel3: false,
    localAreaLabel: 'Local Area *',
    localAreaPlaceholder: 'Enter your local area / neighborhood',
    regions: {
      abu_dhabi: {
        id: 'abu_dhabi',
        name: 'Abu Dhabi',
        districts: [
          { id: 'abu_dhabi_city', name: 'Abu Dhabi City' },
          { id: 'al_ain', name: 'Al Ain' },
          { id: 'al_dhafra', name: 'Al Dhafra' },
          { id: 'yas_island', name: 'Yas Island' },
          { id: 'musaffah', name: 'Musaffah' }
        ]
      },
      dubai: {
        id: 'dubai',
        name: 'Dubai',
        districts: [
          { id: 'downtown_dubai', name: 'Downtown Dubai' },
          { id: 'dubai_marina', name: 'Dubai Marina' },
          { id: 'deira', name: 'Deira' },
          { id: 'bur_dubai', name: 'Bur Dubai' },
          { id: 'jumeirah', name: 'Jumeirah' },
          { id: 'business_bay', name: 'Business Bay' },
          { id: 'al_barsha', name: 'Al Barsha' },
          { id: 'hatta', name: 'Hatta' }
        ]
      },
      sharjah: {
        id: 'sharjah',
        name: 'Sharjah',
        districts: [
          { id: 'sharjah_city', name: 'Sharjah City' },
          { id: 'khor_fakkan', name: 'Khor Fakkan' },
          { id: 'kalba', name: 'Kalba' },
          { id: 'al_dhaid', name: 'Al Dhaid' }
        ]
      },
      ajman: {
        id: 'ajman',
        name: 'Ajman',
        districts: [
          { id: 'ajman_city', name: 'Ajman City' },
          { id: 'manama_ajman', name: 'Manama' },
          { id: 'masfout', name: 'Masfout' }
        ]
      },
      ras_al_khaimah: {
        id: 'ras_al_khaimah',
        name: 'Ras Al-Khaimah',
        districts: [
          { id: 'rak_city', name: 'Ras Al-Khaimah City' },
          { id: 'al_jazirah', name: 'Al Jazirah Al Hamra' },
          { id: 'al_rams', name: 'Al Rams' }
        ]
      },
      fujairah: {
        id: 'fujairah',
        name: 'Fujairah',
        districts: [
          { id: 'fujairah_city', name: 'Fujairah City' },
          { id: 'dibba_fujairah', name: 'Dibba Al-Fujairah' }
        ]
      },
      umm_al_quwain: {
        id: 'umm_al_quwain',
        name: 'Umm Al-Quwain',
        districts: [
          { id: 'uaq_city', name: 'Umm Al-Quwain City' },
          { id: 'falaj_al_mualla', name: 'Falaj Al Mualla' }
        ]
      }
    }
  },

  ethiopia: {
    id: 'ethiopia',
    name: 'Ethiopia',
    level1Label: 'Region / City Administration *',
    level1Placeholder: 'Select Region / City Admin',
    level2Label: 'Zone / Sub-city *',
    level2Placeholder: 'Select Zone / Sub-city',
    hasLevel3: false,
    localAreaLabel: 'Local Area *',
    localAreaPlaceholder: 'Enter your local area / neighborhood',
    regions: {
      addis_ababa: {
        id: 'addis_ababa',
        name: 'Addis Ababa City Administration',
        districts: [
          { id: 'bole', name: 'Bole Sub-city' },
          { id: 'kirkos', name: 'Kirkos Sub-city' },
          { id: 'arada', name: 'Arada Sub-city' },
          { id: 'yeka', name: 'Yeka Sub-city' },
          { id: 'nifas_silk', name: 'Nifas Silk-Lafto Sub-city' },
          { id: 'lideta', name: 'Lideta Sub-city' },
          { id: 'gullele', name: 'Gullele Sub-city' }
        ]
      },
      oromia: {
        id: 'oromia',
        name: 'Oromia Regional State',
        districts: [
          { id: 'finfinne_special', name: 'Finfinne Special Zone' },
          { id: 'east_shewa', name: 'East Shewa Zone (Adama)' },
          { id: 'jimma', name: 'Jimma Zone' },
          { id: 'west_arsi', name: 'West Arsi Zone' },
          { id: 'bale', name: 'Bale Zone' }
        ]
      },
      amhara: {
        id: 'amhara',
        name: 'Amhara Regional State',
        districts: [
          { id: 'west_gojjam', name: 'West Gojjam Zone (Bahir Dar)' },
          { id: 'north_gondar', name: 'North Gondar Zone (Gondar)' },
          { id: 'south_wollo', name: 'South Wollo Zone (Dessie)' }
        ]
      },
      dire_dawa: {
        id: 'dire_dawa',
        name: 'Dire Dawa City Administration',
        districts: [
          { id: 'dire_dawa_urban', name: 'Dire Dawa Urban Sub-city' },
          { id: 'gurgura', name: 'Gurgura Sub-city' }
        ]
      },
      somali: {
        id: 'somali',
        name: 'Somali Regional State',
        districts: [
          { id: 'jijiga', name: 'Jijiga Zone' },
          { id: 'sitti', name: 'Sitti Zone' }
        ]
      },
      sidama: {
        id: 'sidama',
        name: 'Sidama Regional State',
        districts: [
          { id: 'hawassa', name: 'Hawassa City Administration' },
          { id: 'sidama_zone', name: 'Sidama Zone' }
        ]
      }
    }
  },

  indonesia: {
    id: 'indonesia',
    name: 'Indonesia',
    level1Label: 'Province *',
    level1Placeholder: 'Select Province',
    level2Label: 'Regency / City *',
    level2Placeholder: 'Select Regency / City',
    hasLevel3: true,
    level3Label: 'District *',
    level3Placeholder: 'Select District',
    localAreaLabel: 'Village / Local Area *',
    localAreaPlaceholder: 'Enter your local area / neighborhood',
    regions: {
      dki_jakarta: {
        id: 'dki_jakarta',
        name: 'DKI Jakarta',
        districts: {
          jakarta_pusat: {
            id: 'jakarta_pusat',
            name: 'Central Jakarta (Jakarta Pusat)',
            talukas: [
              { id: 'gambir', name: 'Gambir' },
              { id: 'menteng', name: 'Menteng' },
              { id: 'tanah_abang', name: 'Tanah Abang' },
              { id: 'senen', name: 'Senen' },
              { id: 'kemayoran', name: 'Kemayoran' }
            ]
          },
          jakarta_selatan: {
            id: 'jakarta_selatan',
            name: 'South Jakarta (Jakarta Selatan)',
            talukas: [
              { id: 'kebayoran_baru', name: 'Kebayoran Baru' },
              { id: 'setiabudi', name: 'Setiabudi' },
              { id: 'tebet', name: 'Tebet' },
              { id: 'cilandak', name: 'Cilandak' },
              { id: 'pasar_minggu', name: 'Pasar Minggu' }
            ]
          },
          jakarta_barat: {
            id: 'jakarta_barat',
            name: 'West Jakarta (Jakarta Barat)',
            talukas: [
              { id: 'kebon_jeruk', name: 'Kebon Jeruk' },
              { id: 'grogol', name: 'Grogol Petamburan' },
              { id: 'kembangan', name: 'Kembangan' }
            ]
          },
          jakarta_timur: {
            id: 'jakarta_timur',
            name: 'East Jakarta (Jakarta Timur)',
            talukas: [
              { id: 'jatinegara', name: 'Jatinegara' },
              { id: 'matraman', name: 'Matraman' },
              { id: 'duren_sawit', name: 'Duren Sawit' }
            ]
          }
        }
      },
      jawa_barat: {
        id: 'jawa_barat',
        name: 'West Java (Jawa Barat)',
        districts: {
          bandung_city: {
            id: 'bandung_city',
            name: 'Bandung City',
            talukas: [
              { id: 'coblong', name: 'Coblong' },
              { id: 'sukajadi', name: 'Sukajadi' },
              { id: 'sumur_bandung', name: 'Sumur Bandung' }
            ]
          },
          bekasi_city: {
            id: 'bekasi_city',
            name: 'Bekasi City',
            talukas: [
              { id: 'bekasi_barat', name: 'Bekasi Barat' },
              { id: 'bekasi_selatan', name: 'Bekasi Selatan' },
              { id: 'bekasi_timur', name: 'Bekasi Timur' }
            ]
          },
          depok_city: {
            id: 'depok_city',
            name: 'Depok City',
            talukas: [
              { id: 'pancoran_mas', name: 'Pancoran Mas' },
              { id: 'sukmajaya', name: 'Sukmajaya' },
              { id: 'beji', name: 'Beji' }
            ]
          }
        }
      },
      bali: {
        id: 'bali',
        name: 'Bali',
        districts: {
          denpasar_city: {
            id: 'denpasar_city',
            name: 'Denpasar City',
            talukas: [
              { id: 'denpasar_selatan', name: 'Denpasar Selatan' },
              { id: 'denpasar_barat', name: 'Denpasar Barat' },
              { id: 'denpasar_utara', name: 'Denpasar Utara' },
              { id: 'denpasar_timur', name: 'Denpasar Timur' }
            ]
          },
          badung_regency: {
            id: 'badung_regency',
            name: 'Badung Regency',
            talukas: [
              { id: 'kuta', name: 'Kuta' },
              { id: 'kuta_selatan', name: 'Kuta Selatan' },
              { id: 'kuta_utara', name: 'Kuta Utara' },
              { id: 'mengwi', name: 'Mengwi' }
            ]
          }
        }
      }
    }
  },

  iran: {
    id: 'iran',
    name: 'Iran',
    level1Label: 'Province *',
    level1Placeholder: 'Select Province',
    level2Label: 'County *',
    level2Placeholder: 'Select County',
    hasLevel3: true,
    level3Label: 'District *',
    level3Placeholder: 'Select District',
    localAreaLabel: 'Local Area *',
    localAreaPlaceholder: 'Enter your local area / neighborhood',
    regions: {
      tehran: {
        id: 'tehran',
        name: 'Tehran Province',
        districts: {
          tehran_county: {
            id: 'tehran_county',
            name: 'Tehran County',
            talukas: [
              { id: 'central_district_tehran', name: 'Central District' },
              { id: 'aftab_district', name: 'Aftab District' },
              { id: 'kan_district', name: 'Kan District' }
            ]
          },
          shemiranat: {
            id: 'shemiranat',
            name: 'Shemiranat County',
            talukas: [
              { id: 'rudan_qasr', name: 'Rudan-e Qasr District' },
              { id: 'lavasanat', name: 'Lavasanat District' }
            ]
          },
          rey: {
            id: 'rey',
            name: 'Rey County',
            talukas: [
              { id: 'central_district_rey', name: 'Central District' },
              { id: 'kahrizak', name: 'Kahrizak District' }
            ]
          }
        }
      },
      isfahan: {
        id: 'isfahan',
        name: 'Isfahan Province',
        districts: {
          isfahan_county: {
            id: 'isfahan_county',
            name: 'Isfahan County',
            talukas: [
              { id: 'central_district_isfahan', name: 'Central District' },
              { id: 'jarqavieh', name: 'Jarqavieh District' },
              { id: 'kouhpayeh', name: 'Kouhpayeh District' }
            ]
          },
          kashan: {
            id: 'kashan',
            name: 'Kashan County',
            talukas: [
              { id: 'central_district_kashan', name: 'Central District' },
              { id: 'qamsar', name: 'Qamsar District' }
            ]
          }
        }
      },
      fars: {
        id: 'fars',
        name: 'Fars Province',
        districts: {
          shiraz_county: {
            id: 'shiraz_county',
            name: 'Shiraz County',
            talukas: [
              { id: 'central_district_shiraz', name: 'Central District' },
              { id: 'zarqan', name: 'Zarqan District' },
              { id: 'arzhan', name: 'Arzhan District' }
            ]
          }
        }
      },
      razavi_khorasan: {
        id: 'razavi_khorasan',
        name: 'Razavi Khorasan Province',
        districts: {
          mashhad_county: {
            id: 'mashhad_county',
            name: 'Mashhad County',
            talukas: [
              { id: 'central_district_mashhad', name: 'Central District' },
              { id: 'ahmadabad', name: 'Ahmadabad District' }
            ]
          }
        }
      }
    }
  }
}

// Backward compatibility alias for existing Indian hierarchy consumers
export const GEOGRAPHIC_HIERARCHY = BRICS_LOCATION_REGISTRY.india.regions

/**
 * Get the list of all 11 BRICS countries
 */
export function getBricsCountries() {
  return BRICS_COUNTRIES
}

/**
 * Clean normalize string helper
 */
function normalizeKey(str) {
  if (!str) return ''
  return String(str).toLowerCase().trim().replace(/[\s\-_()]/g, '')
}

/**
 * Find country entry by id or name
 */
export function findCountry(countryNameOrId) {
  if (!countryNameOrId) return null
  const clean = normalizeKey(countryNameOrId)
  return Object.values(BRICS_LOCATION_REGISTRY).find(
    (c) => normalizeKey(c.id) === clean || normalizeKey(c.name) === clean
  ) || null
}

/**
 * Get country location configuration and terminology
 */
export function getCountryLocationConfig(countryNameOrId) {
  const country = findCountry(countryNameOrId)
  if (!country) {
    return {
      name: countryNameOrId || '',
      level1Label: 'Administrative Region *',
      level1Placeholder: 'Select...',
      level2Label: 'Administrative Area / City *',
      level2Placeholder: 'Select...',
      hasLevel3: false,
      level3Label: '',
      level3Placeholder: '',
      localAreaLabel: 'Local Area *',
      localAreaPlaceholder: 'Enter your local area / neighborhood'
    }
  }

  return {
    name: country.name,
    level1Label: country.level1Label,
    level1Placeholder: country.level1Placeholder,
    level2Label: country.level2Label,
    level2Placeholder: country.level2Placeholder,
    hasLevel3: Boolean(country.hasLevel3),
    level3Label: country.level3Label || '',
    level3Placeholder: country.level3Placeholder || '',
    localAreaLabel: country.localAreaLabel,
    localAreaPlaceholder: country.localAreaPlaceholder
  }
}

/**
 * Get Level 1 options (States/Provinces/Emirates) for a given country
 */
export function getLevel1Options(countryNameOrId) {
  const country = findCountry(countryNameOrId)
  if (!country || !country.regions) return []

  return Object.values(country.regions).map((r) => ({
    id: r.id,
    name: r.name
  }))
}

/**
 * Get Level 2 options (Districts/Municipalities/Governorates) for a given country and Level 1 region
 */
export function getLevel2Options(countryNameOrId, level1NameOrId) {
  if (!countryNameOrId || !level1NameOrId) return []
  const country = findCountry(countryNameOrId)
  if (!country || !country.regions) return []

  const cleanL1 = normalizeKey(level1NameOrId)
  const region = Object.values(country.regions).find(
    (r) => normalizeKey(r.id) === cleanL1 || normalizeKey(r.name) === cleanL1
  )
  if (!region || !region.districts) return []

  // Check if districts is an Array or Object map
  if (Array.isArray(region.districts)) {
    return region.districts.map((d) => ({
      id: d.id,
      name: d.name
    }))
  }

  return Object.values(region.districts).map((d) => ({
    id: d.id,
    name: d.name
  }))
}

/**
 * Get Level 3 options (Talukas/Woredas/Kecamatan/Bakhsh) for 3-level countries
 */
export function getLevel3Options(countryNameOrId, level1NameOrId, level2NameOrId) {
  if (!countryNameOrId || !level1NameOrId || !level2NameOrId) return []
  const country = findCountry(countryNameOrId)
  if (!country || !country.hasLevel3 || !country.regions) return []

  const cleanL1 = normalizeKey(level1NameOrId)
  const region = Object.values(country.regions).find(
    (r) => normalizeKey(r.id) === cleanL1 || normalizeKey(r.name) === cleanL1
  )
  if (!region || !region.districts || Array.isArray(region.districts)) return []

  const cleanL2 = normalizeKey(level2NameOrId)
  const dist = Object.values(region.districts).find(
    (d) => normalizeKey(d.id) === cleanL2 || normalizeKey(d.name) === cleanL2
  )
  if (!dist || !dist.talukas) return []

  return dist.talukas || []
}

// Flat lookup helpers for legacy Indian references
export function getAllStates() {
  return getLevel1Options('India')
}

export function getDistrictsForState(stateIdOrName) {
  return getLevel2Options('India', stateIdOrName)
}

export function getTalukasForDistrict(stateIdOrName, districtIdOrName) {
  return getLevel3Options('India', stateIdOrName, districtIdOrName)
}

/**
 * Universal Location Metadata resolver for all BRICS countries
 */
export function resolveLocationMetadata({ country = 'India', state = '', district = '', taluka = '' }) {
  const countryConfig = findCountry(country) || BRICS_LOCATION_REGISTRY.india
  const l1List = getLevel1Options(countryConfig.id)

  let resolvedState = l1List.find(
    (s) => normalizeKey(s.name) === normalizeKey(state) || s.id === state
  )
  if (!resolvedState && l1List.length > 0 && countryConfig.id === 'india' && !state) {
    resolvedState = l1List[0]
  }

  const resolvedStateName = resolvedState ? resolvedState.name : (state || '')
  const resolvedStateId = resolvedState ? resolvedState.id : normalizeKey(state || 'state')

  const l2List = getLevel2Options(countryConfig.id, resolvedStateId)
  let resolvedDist = l2List.find(
    (d) => normalizeKey(d.name) === normalizeKey(district) || d.id === district
  )
  if (!resolvedDist && l2List.length > 0 && countryConfig.id === 'india' && !district) {
    resolvedDist = l2List[0]
  }

  const resolvedDistName = resolvedDist ? resolvedDist.name : (district || '')
  const resolvedDistId = resolvedDist ? resolvedDist.id : normalizeKey(district || 'district')

  let resolvedTalukaName = taluka || ''
  let resolvedTalukaId = normalizeKey(taluka || '')

  if (countryConfig.hasLevel3) {
    const l3List = getLevel3Options(countryConfig.id, resolvedStateId, resolvedDistId)
    const foundTaluka = l3List.find(
      (t) => normalizeKey(t.name) === normalizeKey(taluka) || t.id === taluka
    )
    if (foundTaluka) {
      resolvedTalukaName = foundTaluka.name
      resolvedTalukaId = foundTaluka.id
    } else if (l3List.length > 0 && countryConfig.id === 'india' && !taluka) {
      resolvedTalukaName = l3List[0].name
      resolvedTalukaId = l3List[0].id
    }
  }

  return {
    country: countryConfig.name,
    stateId: resolvedStateId,
    stateName: resolvedStateName,
    state: resolvedStateName,
    districtId: resolvedDistId,
    districtName: resolvedDistName,
    district: resolvedDistName,
    talukaId: resolvedTalukaId,
    talukaName: resolvedTalukaName,
    taluka: resolvedTalukaName
  }
}

