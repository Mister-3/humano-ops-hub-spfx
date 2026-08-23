import type { ICatalogoItem } from '../../../../types';
import { getKudoMedalDefinition, normalizeKudoAttribute } from '../Dashboard/KudoMedals';

export interface IKudoConceptCriteria {
  id: string;
  text: string;
  isCustom?: boolean;
}

export interface IKudoAttributeGroup {
  attribute: string;
  iconName: string;
  description: string;
  criteria: IKudoConceptCriteria[];
}

export const DEFAULT_KUDO_MATRIX: ReadonlyArray<IKudoAttributeGroup> = [
  {
    attribute: 'Empatía',
    iconName: 'Heart',
    description: 'Trato humano, cercanía y comprensión genuina con usuarios y compañeros de equipo.',
    criteria: [
      {
        id: 'emp-1',
        text: 'Trato humano, cálido y paciente demostrado en la atención de usuarios y compañeros.'
      },
      {
        id: 'emp-2',
        text: 'Escucha activa y contención efectiva ante reclamos o situaciones operativas complejas.'
      },
      {
        id: 'emp-3',
        text: 'Acompañamiento cercano y orientación voluntaria a nuevos integrantes del equipo.'
      }
    ]
  },
  {
    attribute: 'Agilidad',
    iconName: 'LightningBolt',
    description: 'Velocidad, adaptabilidad y efectividad en la entrega de resultados y respuesta ante contingencias.',
    criteria: [
      {
        id: 'agi-1',
        text: 'Respuesta veloz y resolutiva ante picos de volumen o contingencias operativas.'
      },
      {
        id: 'agi-2',
        text: 'Optimización del tiempo de ciclo en radicación, escaneo o emisiones manteniendo cero errores.'
      },
      {
        id: 'agi-3',
        text: 'Celeridad en el tratamiento y desbloqueo de radicaciones críticas o próximas a SLA.'
      }
    ]
  },
  {
    attribute: 'Pensamiento digital',
    iconName: 'Devices3',
    description: 'Aprovechamiento de tecnologías, datos y herramientas de vanguardia para transformar la operación.',
    criteria: [
      {
        id: 'pdig-1',
        text: 'Adopción temprana y aprovechamiento avanzado de las herramientas de Manager Hub.'
      },
      {
        id: 'pdig-2',
        text: 'Propuesta de automatizaciones, plantillas o mejoras tecnológicas para simplificar procesos.'
      },
      {
        id: 'pdig-3',
        text: 'Detección proactiva y reporte estructurado de oportunidades de optimización digital.'
      }
    ]
  },
  {
    attribute: 'Orientado al negocio',
    iconName: 'Bullseye',
    description: 'Enfoque en metas cuantitativas, calidad de servicio y generación de valor sostenible.',
    criteria: [
      {
        id: 'oneg-1',
        text: 'Cumplimiento sobresaliente y sostenido de metas de productividad y SLA del período.'
      },
      {
        id: 'oneg-2',
        text: 'Compromiso con la reducción de costos operativos y mitigación proactiva de riesgos.'
      },
      {
        id: 'oneg-3',
        text: 'Alineación rigurosa con los objetivos estratégicos y estándares de calidad de la organización.'
      }
    ]
  },
  {
    attribute: 'Resolución de problemas',
    iconName: 'Lightbulb',
    description: 'Capacidad de análisis e ingenio para solucionar bloqueos e incidencias complejas.',
    criteria: [
      {
        id: 'rprob-1',
        text: 'Iniciativa para investigar la causa raíz y resolver casos atascados o con excepciones.'
      },
      {
        id: 'rprob-2',
        text: 'Capacidad de análisis para prevenir la recurrencia de errores de proceso o faltas.'
      },
      {
        id: 'rprob-3',
        text: 'Destreza en la toma de decisiones oportunas ante escenarios operativos imprevistos.'
      }
    ]
  },
  {
    attribute: 'Trabajo en equipo',
    iconName: 'Group',
    description: 'Colaboración solidaria, fomento de la sinergia y apoyo incondicional al colectivo.',
    criteria: [
      {
        id: 'tequ-1',
        text: 'Apoyo desinteresado a otros compañeros para equilibrar cargas de trabajo en horas pico.'
      },
      {
        id: 'tequ-2',
        text: 'Promoción de un ambiente armónico, respetuoso, colaborativo y motivador.'
      },
      {
        id: 'tequ-3',
        text: 'Disponibilidad voluntaria para coberturas y respaldo en proyectos transversales.'
      }
    ]
  }
];

export const buildKudoCriteriaMatrix = (
  catalogItems: ReadonlyArray<ICatalogoItem> = []
): IKudoAttributeGroup[] => {
  // Copia inicial de la matriz estándar
  const groupsMap = new Map<string, IKudoAttributeGroup>();

  DEFAULT_KUDO_MATRIX.forEach((group) => {
    const key = normalizeKudoAttribute(group.attribute);
    groupsMap.set(key, {
      ...group,
      criteria: [...group.criteria]
    });
  });

  // Agregar atributos de Kudo personalizados si existen en el catálogo
  const kudoAttrItems = catalogItems.filter((i) => i.Title === 'Kudo' && i.activo !== false);
  kudoAttrItems.forEach((item) => {
    const value = item.Valor.trim();
    if (!value) return;
    const key = normalizeKudoAttribute(value);
    if (!groupsMap.has(key)) {
      const def = getKudoMedalDefinition(value);
      groupsMap.set(key, {
        attribute: def.attribute,
        iconName: def.iconName,
        description: `Criterios asociados al atributo ${def.attribute}`,
        criteria: []
      });
    }
  });

  // Vincular conceptos dinámicos de Kudo (ConceptoKudo) según su parent_id
  const kudoConceptItems = catalogItems.filter(
    (i) => (i.Title === 'ConceptoKudo' || (i as any).Title === 'ConceptoKudos') && i.activo !== false
  );

  kudoConceptItems.forEach((conceptItem) => {
    const conceptText = conceptItem.Valor.trim();
    if (!conceptText) return;

    const parentId = conceptItem.parent_id ? String(conceptItem.parent_id).trim() : '';
    // Buscar si parentId coincide con rawId/Id de algún Kudo o con el nombre directo
    let targetKey = '';

    if (parentId) {
      const parentKudo = kudoAttrItems.find(
        (k) => String(k.rawId ?? k.Id) === parentId || k.Valor.toLowerCase() === parentId.toLowerCase()
      );
      if (parentKudo) {
        targetKey = normalizeKudoAttribute(parentKudo.Valor);
      } else {
        targetKey = normalizeKudoAttribute(parentId);
      }
    }

    if (!targetKey || !groupsMap.has(targetKey)) {
      // Fallback al primer grupo o asociar si coincide con algún nombre normalizado
      for (const [k] of groupsMap) {
        if (normalizeKudoAttribute(parentId) === k) {
          targetKey = k;
          break;
        }
      }
    }

    if (targetKey && groupsMap.has(targetKey)) {
      const group = groupsMap.get(targetKey)!;
      // Evitar duplicados
      if (!group.criteria.some((c) => c.text.toLowerCase() === conceptText.toLowerCase())) {
        group.criteria.push({
          id: `custom-${conceptItem.rawId ?? conceptItem.Id ?? Math.random().toString()}`,
          text: conceptText,
          isCustom: true
        });
      }
    }
  });

  return Array.from(groupsMap.values());
};
